// Expand the actual deferred entrypoints for existing source-level regression tests.
const fs=require('node:fs'),path=require('node:path');
module.exports=function readStorefront(){
 const root=path.resolve(__dirname,'..');
 return fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="(js\/storefront(?:-extras)?(?:\.min)?\.js)\?[^\"]*" defer><\/script>/g,(_,file)=>'<script>\n'+fs.readFileSync(path.join(root,file.replace('.min.js','.js')),'utf8')+'</script>');
};
