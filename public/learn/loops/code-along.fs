\ Code along — Starting Henceforth episode
\ https://henceforth.club/learn/loops
\ Type each line into Henceforth, or INCLUDE this file from the Files tab.

 counting:

 done.

count-up

 liftoff in:

 liftoff!

countdown

 100 sats at 12%/yr:

 yr

 :

 compounded.

grow

variable candidate

variable composite

: divides?  candidate @ swap mod 0= ;

: worth-testing?  dup dup * candidate @ > 0= ;

: prime?  candidate !  candidate @ 2 < if false exit then  candidate @ 2 = if true exit then  candidate @ 2 mod 0= if false exit then  false composite !  3  begin worth-testing? while  dup divides? if true composite ! then  2 +  repeat drop  composite @ 0= ;

 primes 0..100:

primes
