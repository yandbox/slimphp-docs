@echo off

set name=slimphp
set link=\d.com\sites\www\%name%
if exist %link% rmdir %link%
mklink /j %link% public

set link=public\index.html
if exist %link% del %link%
mklink /h %link% public\docs\hello-world.html
