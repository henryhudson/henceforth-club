\ Code along — Starting Henceforth episode
\ https://henceforth.club/learn/bitcoin-script
\ Type each line into Henceforth, or INCLUDE this file from the Files tab.

op_3 op_4 op_add .ds

op_3 op_dup .ds

script-begin

op_dup op_hash160

0x62e907b15cbf27d5425399ebf6f0fb50ebb88f18

op_equalverify op_checksig

script-end

checksig-fixture

: lock5 5 0 do op_dup loop ;
