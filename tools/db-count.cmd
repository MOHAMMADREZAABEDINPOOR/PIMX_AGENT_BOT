@echo off
cd /d "%~dp0.."
call node_modules\.bin\wrangler.cmd d1 execute telegram-multi-ai-bots --remote --command "SELECT COUNT(*) AS n FROM kv_store;"
