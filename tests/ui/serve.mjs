import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const server=await createServer({configFile:false,plugins:[react(),{name:'fixture-html',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!req.url.includes('.')&&!req.url.startsWith('/@')) req.url='/tests/ui/index.html';next();});}}],resolve:{alias:[{find:'@/api/base44Client',replacement:path.resolve('tests/ui/client.js')},{find:'@/lib/AuthContext',replacement:path.resolve('tests/ui/auth.js')},{find:'@/lib/geo',replacement:path.resolve('tests/ui/geo.js')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:5187,strictPort:true}});
await server.listen();console.log('Local fixture http://127.0.0.1:5187/operations');
