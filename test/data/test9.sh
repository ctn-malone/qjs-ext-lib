#!/bin/sh

##
# 
# Read lines from stdin and output then back with a prefix
#
# Exit using exit code = 0
#
##

while read line
do
    echo "[in] ${line}"
done
# ensure last line is printed
echo "[in] ${line}"
exit 0
