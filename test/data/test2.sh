#!/bin/sh

##
# 
# Count from 1 to N (defined by $1) and :
#
# - print iteration number on stdout for every even iteration
# - print iteration number on stderr for every odd iteration
# - sleep 0.1s after first even iteration
# - sleep 0.1s after first odd iteration
# - \n is only added at the end
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
                echo -n "$i"
                [ $i -eq 2 ] && sleep 0.1
            else
                echo -n "$i" 1>&2
                [ $i -eq 1 ] && sleep 0.1
            fi
    	done
    fi
fi
echo ""
echo "" 1>&2
[ -z $2 ] && exit 0
exit $2
