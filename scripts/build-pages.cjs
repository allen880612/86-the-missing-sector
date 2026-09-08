'use strict';

const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const root=process.cwd();
const dist=path.join(root,'dist');
const maxFiles=20000;
const maxBytes=25*1024*1024;
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);

const forbidden=tracked.filter(file=>file.split('/').includes('functions')||file.split('/').includes('_worker.js'));
if(forbidden.length)throw new Error(`Static Pages build rejects Functions/Workers files:\n${forbidden.join('\n')}`);

const selected=tracked.filter(file=>
 file==='index.html'||file==='changelog.html'||
 file==='style.css'||
 (/^game[^/]*\.js$/.test(file)&&!file.endsWith('.test.js'))||
 file.startsWith('assets/')||
 file==='art-direction/86-reference/design-overview.html'||
 /^art-direction\/86-reference\/images\/(official-[a-z0-9-]+\.jpg|concept-key-visual\.png)$/.test(file)
);

if(!selected.includes('index.html'))throw new Error('Missing tracked runtime entry: index.html');
if(selected.length>=maxFiles)throw new Error(`Pages file limit reached: ${selected.length} >= ${maxFiles}`);

for(const file of selected){
 if(path.isAbsolute(file)||file.split('/').includes('..'))throw new Error(`Unsafe tracked path: ${file}`);
 const source=path.join(root,file),stat=fs.lstatSync(source);
 if(stat.isSymbolicLink())throw new Error(`Symlink rejected: ${file}`);
 if(!stat.isFile())throw new Error(`Non-file rejected: ${file}`);
 if(stat.size>=maxBytes)throw new Error(`File is at least 25 MiB: ${file} (${stat.size} bytes)`);
}

fs.rmSync(dist,{recursive:true,force:true});
for(const file of selected){
 const target=path.join(dist,file);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(path.join(root,file),target);
}

const output=[];
for(const stack=[dist];stack.length;){
 const current=stack.pop();
 for(const entry of fs.readdirSync(current,{withFileTypes:true})){
  const absolute=path.join(current,entry.name);
  if(entry.isSymbolicLink())throw new Error(`Symlink appeared in dist: ${path.relative(dist,absolute)}`);
  if(entry.isDirectory())stack.push(absolute);else output.push(absolute);
 }
}
if(output.length!==selected.length)throw new Error(`Build count mismatch: copied ${output.length} of ${selected.length}`);
console.log(`Built ${output.length} tracked static files in dist/`);
