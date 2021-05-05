#!/bin/sh

##
# 
# - sleep N seconds (first argument) if first argument is defined
# - print OK
#
# Exit using exit code = 0
#
##

if ! [ -z $1 ]
then
    if [ $1 -gt 0 ]
    then
        sleep $1
    fi
fi
echo "OK"
exit 0
