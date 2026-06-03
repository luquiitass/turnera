// Script de diagnóstico — importa módulos uno a uno para identificar cuál crashea
import { writeFileSync } from 'fs';

function log(msg: string) {
  process.stdout.write(msg + '\n');
  try { writeFileSync('/tmp/debug.log', msg + '\n', { flag: 'a' }); } catch {}
}

log('[DEBUG] Node.js arrancó correctamente');
log('[DEBUG] Node version: ' + process.version);
log('[DEBUG] Platform: ' + process.platform + ' ' + process.arch);

try { await import('dotenv/config'); log('[DEBUG] dotenv OK'); } catch (e: any) { log('[DEBUG] dotenv FAIL: ' + e.message); }
try { await import('@nestjs/core'); log('[DEBUG] @nestjs/core OK'); } catch (e: any) { log('[DEBUG] @nestjs/core FAIL: ' + e.message); }
try { await import('@prisma/client'); log('[DEBUG] @prisma/client OK'); } catch (e: any) { log('[DEBUG] @prisma/client FAIL: ' + e.message); }
try { await import('@prisma/adapter-pg'); log('[DEBUG] @prisma/adapter-pg OK'); } catch (e: any) { log('[DEBUG] @prisma/adapter-pg FAIL: ' + e.message); }
try { await import('pg'); log('[DEBUG] pg OK'); } catch (e: any) { log('[DEBUG] pg FAIL: ' + e.message); }
try { await import('bcrypt'); log('[DEBUG] bcrypt OK'); } catch (e: any) { log('[DEBUG] bcrypt FAIL: ' + e.message); }
try { await import('@aws-sdk/client-s3'); log('[DEBUG] aws-sdk OK'); } catch (e: any) { log('[DEBUG] aws-sdk FAIL: ' + e.message); }
try { await import('express'); log('[DEBUG] express OK'); } catch (e: any) { log('[DEBUG] express FAIL: ' + e.message); }

log('[DEBUG] Todos los módulos cargaron. El crash es en app startup.');
process.exit(0);
