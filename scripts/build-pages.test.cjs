const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const build=path.join(__dirname,'build-pages.cjs');

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pages-build-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 execFileSync('git',['init','-q'],{cwd:root});
 fs.writeFileSync(path.join(root,'index.html'),'game');
 return root;
}
function run(root){
 execFileSync('git',['add','.'],{cwd:root});
 return spawnSync(process.execPath,[build],{cwd:root,encoding:'utf8'});
}
test('publishes runtime only and removes stale output',t=>{
 const root=fixture(t);
 for(const file of ['changelog.html','game.js','game.test.js','private.txt','assets/sprite.png','art-direction/86-reference/images/secret-notes.png']){
  fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'sample');
 }
 assert.equal(run(root).status,0);
 fs.writeFileSync(path.join(root,'dist','stale.txt'),'private');
 fs.writeFileSync(path.join(root,'assets','untracked.png'),'private');
 const result=spawnSync(process.execPath,[build],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 for(const file of ['changelog.html','game.js','assets/sprite.png'])assert.ok(fs.existsSync(path.join(root,'dist',file)));
 for(const file of ['game.test.js','private.txt','stale.txt','assets/untracked.png','art-direction/86-reference/images/secret-notes.png'])assert.equal(fs.existsSync(path.join(root,'dist',file)),false);
});
for(const entry of ['functions/api.js','_worker.js','_worker.js/index.js'])test(`rejects server execution: ${entry}`,t=>{
 const root=fixture(t);fs.mkdirSync(path.dirname(path.join(root,entry)),{recursive:true});fs.writeFileSync(path.join(root,entry),'');
 const result=run(root);assert.notEqual(result.status,0);assert.match(result.stderr,/rejects Functions\/Workers/);
});
test('rejects symlinked asset',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'assets'));fs.symlinkSync('../index.html',path.join(root,'assets','link.png'));
 const result=run(root);assert.notEqual(result.status,0);assert.match(result.stderr,/Symlink rejected/);
});
test('rejects asset at the free-plan size boundary',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'assets'));const fd=fs.openSync(path.join(root,'assets','large.bin'),'w');fs.ftruncateSync(fd,25*1024*1024);fs.closeSync(fd);
 const result=run(root);assert.notEqual(result.status,0);assert.match(result.stderr,/25 MiB/);
});
