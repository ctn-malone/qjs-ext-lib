#!/bin/sh

##
# 
# Count from 1 to N (defined by $1) and :
#
# - print iteration number on stdout for every even iteration
# - sleep 0.1s between each iteration
#
# Exit using an exit code defined by $2 (default = 0)
#
##

if ! [ -z $1 ]
then
    if [ $1 -gt 0 ]
    then
    	for i in $(seq 1 $1)
    	do
            echo "$i"
            sleep 0.1
    	done
    fi
fi
[ -z $2 ] && exit 0
exit $2
