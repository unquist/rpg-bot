#!/bin/bash
if [ "$#" -ne 2 ] ; then
	echo 'Usage: roll.sh COMMAND, ex roll.sh "1d20+2 adv"'
fi
echo "rolling $1"
curl -i -X POST localhost:8080/hubot/roll --data @test.data --data-urlencode "text=$1"
 
