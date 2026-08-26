import { describe, expect, it } from "vitest";
import { extractTargetTxid } from "./extractTarget";

const ID = "ab".repeat(32);

describe("extractTargetTxid", () => {
  it("accepts raw hex, mixed case → lowercase", () => {
    expect(extractTargetTxid(ID.toUpperCase())).toBe(ID);
  });

  it("pulls from folklore / whatsonchain / treechat /t/ URLs", () => {
    expect(extractTargetTxid(`https://www.henceforth.club/folklore/tx/${ID}`)).toBe(ID);
    expect(extractTargetTxid(`https://whatsonchain.com/tx/${ID}`)).toBe(ID);
    expect(extractTargetTxid(`https://treechat.com/t/${ID}`)).toBe(ID);
  });

  it("junk and short hex are null", () => {
    expect(extractTargetTxid("nope")).toBeNull();
    expect(extractTargetTxid("abc")).toBeNull();
  });
});
