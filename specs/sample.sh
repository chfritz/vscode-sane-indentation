#!/bin/bash

echo "hello"

set -e

while (true); do
  sleep 1;
  echo '.'
done;

if [[ $# > 2 ]]; then
  UBUNTU_RELEASE=$(lsb_release -sc)
  curl -s http://something.com?$UBUNTU_RELEASE

elif [[ $# > 1 ]]; then
  echo "1"

else
  echo "none"

  while (true); do
    sleep 1;
    echo '.'
  done;

fi

vi $TARGETFILE <<x23LimitStringx23
i
This is line 1 of the example file.
This is line 2 of the example file.
^[
ZZ
x23LimitStringx23

case $CHOICE in
1)
  echo "You are in the main menu";;
2)
  echo "You asked for help";;
3)
  echo "You exit";;
*)
  echo "Choose a number between 1 and 3";;
esac

if true; then
  case $CHOICE in
  1)
    echo "You are in the main menu";;
  2)
    echo "You asked for help";;
  3)
    echo "You exit";;
  *)
    echo "Choose a number between 1 and 3";;
  esac
fi;

dappend() {
 	date
 	cat
}

