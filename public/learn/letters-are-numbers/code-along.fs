\ Code along — Starting Henceforth episode
\ https://henceforth.club/learn/letters-are-numbers
\ Type each line into Henceforth, or INCLUDE this file from the Files tab.

 hello, i speak forth

42 emit

65 emit 66 emit 67 emit

: star  42 emit ;

star

32 emit

 the dog

 runs

 home.

: story  dog space runs space home cr ;

story

: s1  cr star ;

: s2  s1 star ;

: s3  s2 star ;

: s4  s3 star ;

: s5  s4 star ;

: s6  s5 star ;

: s7  s6 star ;

: tri  s1 s2 s3 s4 s5 s6 s7 cr ;

tri

 forth
