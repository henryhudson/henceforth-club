import { NextRequest, NextResponse } from 'next/server'
import { generateDigest } from '@/lib/this-week/generate'
import path from 'path'
import fs from 'fs/promises'

export async function GET(request: NextRequest) {
  // Auth: require Bearer CRON_SECRET (Vercel Cron sends this automatically)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const digest = await generateDigest(now)
    // Mark as published (the generator always returns 'draft')
    const published = { ...digest, status: 'published' as const }
    const filename = `${digest.week}.json`
    const content = JSON.stringify(published, null, 2)

    const githubToken = process.env.GITHUB_TOKEN

    if (githubToken) {
      // Commit to a new branch via GitHub API and open a PR
      const { Octokit } = await import('@octokit/rest')
      const octokit = new Octokit({ auth: githubToken })

      const owner = process.env.GITHUB_OWNER ?? 'henryhudson'
      const repo = process.env.GITHUB_REPO ?? 'henceforth-club'
      const filePath = `content/this-week/${filename}`
      const branch = `this-week/${digest.week}`
      const commitMessage = `This Week in Parliament — ${digest.windowLabel}`

      // Get main branch SHA
      const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' })
      const baseSha = ref.object.sha

      // Create branch
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      })

      // Create or update file on that branch
      let existingSha: string | undefined
      try {
        const { data: existing } = await octokit.repos.getContent({ owner, repo, path: filePath, ref: branch })
        if (!Array.isArray(existing) && 'sha' in existing) existingSha = existing.sha
      } catch {
        // File doesn't exist yet — that's fine
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      })

      // Open PR
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo,
        title: commitMessage,
        head: branch,
        base: 'main',
        body: `Auto-generated weekly Parliament digest for **${digest.windowLabel}**.\n\nMode: \`${digest.mode}\`\n\nReview and merge to publish.`,
      })

      console.log(`[this-week] PR opened: ${pr.html_url}`)
      return NextResponse.json({ ok: true, week: digest.week, mode: digest.mode, pr: pr.html_url })
    }

    // No GITHUB_TOKEN — write draft locally so the route works in dev
    const localPath = path.join(process.cwd(), 'content', 'this-week', filename)
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, content, 'utf-8')
    console.log(`[this-week] no GITHUB_TOKEN — wrote draft locally: ${localPath}`)
    return NextResponse.json({ ok: true, week: digest.week, mode: digest.mode })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[this-week] cron handler error: ${message}`)
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 })
  }
}
