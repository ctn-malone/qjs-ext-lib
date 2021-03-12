#!/bin/sh

##
# 
# Count from 1 to N (defined by $1) and :
#
# - print iteration number on stdout for every even iteration
# - print iteration number on stderr for every odd iteration
# - extra lines is added after each iteration
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
            if [ $(($i % 2)) -eq 0 ]
            then
                echo "$i"
                echo ""
            else
                echo "$i" 1>&2
                echo "" 1>&2
            fi
    	done
    fi
fi
[ -z $2 ] && exit 0
exit $2
