#!/bin/sh

##
# 
# Count from 1 to N (defined by $1) and :
#
# - print iteration number on stdout for every even iteration
# - print iteration number on stderr for every odd iteration
# - spaces and extra lines are added at the beginning & at the end
#
# Exit using an exit code defined by $2 (default = 0)
#
##

printf "\n\n   "
printf "\n\n   " 1>&2
if ! [ -z $1 ]
then
    if [ $1 -gt 0 ]
    then
    	for i in $(seq 1 $1)
    	do
            if [ $(($i % 2)) -eq 0 ]
            then
                echo "$i"
            else
                echo "$i" 1>&2
            fi
    	done
    fi
fi
printf "\n\n   "
printf "\n\n   " 1>&2
[ -z $2 ] && exit 0
exit $2
