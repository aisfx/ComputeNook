#!/bin/bash
ssh root@hpc "rm -f /root/test/*.tar.gz"
scp ./release/computenook-*.tar.gz  root@hpc:/root/test/
ssh root@hpc "cd /root/test ; tar -zxvf *.tar.gz"
