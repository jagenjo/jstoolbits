var KEYS={},KEYSP={},MOUSE={pos:[0,0],delta:[0,0],wheel:0,buttons:0}
var gl=0,BODY=document.body,F=0
BODY.onkeydown=BODY.onkeyup=function(e){var v=e.type=="keydown",c=e.code.substr(0,3)=="Key"?e.code.substr(3):e.code;KEYSP[c]=(v&&!KEYS[c]);KEYS[c]=v;if(window.ONKEY)ONKEY(e)};
var D2R=0.0174532925
var maths=Object.getOwnPropertyNames(Math)
for(var i in maths) window[maths[i].toUpperCase()]=Math[maths[i]]
CLAMP=(a,b,c)=>{return MIN(MAX(a,b),c)}
SATURATE=(a)=>{return CLAMP(a,0,1)}
var F32=Float32Array,UINT8=Uint8Array,F32P=F32.prototype,IDM4=new F32([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),ARRP=Array.prototype
F32P.MUL=function(v){return v.length==16?MULTMAT4(M4(),this,v):(this.length==16?MAT4xV3(V3(),this,v):V3([this[0]*v[0],this[1]*v[1],this[2]*v[2]]))}
F32P.ADD=function(v){return ADD(V3(),this,v)},F32P.SUB=function(v){return SUB(V3(),this,v)}
F32P.SCALE=function(v){return SCALE(V3(),this,v)}
ARRP.MUL=function(v){return this.map(a=>a*v)}
V3=(v)=>{return new F32(v||3)},UP=V3([0,1,0])
M4=(v)=>new F32(v||IDM4);
var VP_DATA=new F32(4),ZERO=V3(),TEMPV3=V3(),TEMPV3B=V3(),TEMPV4=V3(4)
INIT=(C)=>{if(!gl){gl=C.getContext("webgl2",{});_INITGL()}VIEWPORT(0,0,C.width,C.height)}
INPUT=(C)=>{C.oncontextmenu=(e)=>false;C.onmousedown=C.onmouseup=C.onmousemove=(e)=>{e.preventDefault();MOUSE.delta[0]=e.pageX-MOUSE.pos[0],MOUSE.delta[1]=e.pageY-MOUSE.pos[1],MOUSE.pos[0]=e.pageX,MOUSE.pos[1]=e.pageY;MOUSE.buttons=e.buttons;if(window.ONMOUSE)ONMOUSE(e)};BODY.onwheel=(e)=>MOUSE.wheel=e.deltaY}
ENDFRAME=()=>{MOUSE.delta.fill(0);KEYSP={};MOUSE.wheel=0}
VIEWPORT=(x,y,w,h)=>{VP_DATA.set([x,y,w,h]);gl.viewport(x,y,w,h)}
TIME=()=>performance.now()*.001;
LERP=(a,b,f)=>a*(1-f)+b*f;
ILERP=(a,b,v)=>(v-a)/(b-a);
REMAP=(v,low1,high1,low2,high2)=>LERP(low2,high2,ILERP(low1,high1,v));
RAND=(v=1,offset=0)=>RANDOM()*v+(offset)
FRACT=(i)=>i-FLOOR(i);
ADD=(t,n,r,s=1)=>{return t[0]=n[0]+r[0]*s,t[1]=n[1]+r[1]*s,t[2]=n[2]+r[2]*s,t}//add but also scale and add
SUB=(t,n,r)=>{return t[0]=n[0]-r[0],t[1]=n[1]-r[1],t[2]=n[2]-r[2],t}
SCALE=(t,n,r)=>{t=t||V3();if(r.length){t[0]=n[0]*r[0],t[1]=n[1]*r[1],t[2]=n[2]*r[2]}else{t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r};return t}
DOT=(t,n)=>t[0]*n[0]+t[1]*n[1]+t[2]*n[2];
CROSS=(t,n,r)=>{var a=n[0],e=n[1],u=n[2],o=r[0],i=r[1],s=r[2];return t[0]=e*s-u*i,t[1]=u*o-a*s,t[2]=a*i-e*o,t}
LEN=(t)=>SQRT(t[0]*t[0]+t[1]*t[1]+t[2]*t[2]);
ROTY=(o,v,a)=>{o=o||V3();o[0]=COS(a)*v[0]-SIN(a)*v[2];o[1]=v[1];o[2]=SIN(a)*v[0]+COS(a)*v[2];return o}
LERPV3=(o,a,b,f)=>{for(var i=0;i<o.length;++i)o[i]=a[i]*(1-f)+b[i]*f;return o}
NORM=(t,n)=>{var r=n[0],a=n[1],e=n[2],u=r*r+a*a+e*e;return u>0&&(u=1/SQRT(u),t[0]=n[0]*u,t[1]=n[1]*u,t[2]=n[2]*u),t}
DIST=(t,n)=>{var r=n[0]-t[0],a=n[1]-t[1],e=n[2]-t[2];return SQRT(r*r+a*a+e*e)}
TMAT4=(t,n)=>{t.set(IDM4);return t[12]=n[0],t[13]=n[1],t[14]=n[2],t}
RMAT4=(t,n,r)=>{var e=r[0],u=r[1],o=r[2],i=SQRT(e*e+u*u+o*o),s=0,c=0,f=0;if(i<0.0001)return null;return e*=i=1/i,u*=i,o*=i,s=SIN(n),c=COS(n),f=1-c,t[0]=e*e*f+c,t[1]=u*e*f+o*s,t[2]=o*e*f-u*s,t[3]=0,t[4]=e*u*f-o*s,t[5]=u*u*f+c,t[6]=o*u*f+e*s,t[7]=0,t[8]=e*o*f+u*s,t[9]=u*o*f-e*s,t[10]=o*o*f+c,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}
SMAT4=(t,n)=>{t=t||M4();if(n.constructor===Number)n=[n,n,n];t.set(IDM4);return t[0]=n[0],t[5]=n[1],t[10]=n[2],t}
APPLYTRANS=(m,n,v)=>{var t=TMAT4(M4(),v);return MULTMAT4(m||t,n,t)}
APPLYROT=(m,n,a,v)=>{var r=RMAT4(M4(),a,v);return MULTMAT4(m||r,n,r)}
APPLYSCALE=(m,n,v)=>{var s=SMAT4(M4(),v);return MULTMAT4(m||s,n,s)}
COLOR=(v,a=255)=>[v>>16&255,v>>8&255,v&255,a].MUL(1/255)
TRS=(m,t,r,s,M)=>{m=m||M4();var T=TMAT4(M4(),t);var R=M4();if(r){if(r[0])APPLYROT(R,R,r[0],[1,0,0]);if(r[1])APPLYROT(R,R,r[1],[0,1,0]);if(r[2])APPLYROT(R,R,r[2],[0,0,1]);}var S=SMAT4(M4(),s);MULTMAT4(m,M||M4(),T);MULTMAT4(m,m,R);return MULTMAT4(m,m,S)}
//MULTMAT4=(t,n,r)=>{var a=n[0],e=n[1],u=n[2],o=n[3],i=n[4],s=n[5],c=n[6],f=n[7],M=n[8],h=n[9],l=n[10],v=n[11],d=n[12],b=n[13],m=n[14],p=n[15],P=r[0],A=r[1],E=r[2],O=r[3];return t[0]=P*a+A*i+E*M+O*d,t[1]=P*e+A*s+E*h+O*b,t[2]=P*u+A*c+E*l+O*m,t[3]=P*o+A*f+E*v+O*p,P=r[4],A=r[5],E=r[6],O=r[7],t[4]=P*a+A*i+E*M+O*d,t[5]=P*e+A*s+E*h+O*b,t[6]=P*u+A*c+E*l+O*m,t[7]=P*o+A*f+E*v+O*p,P=r[8],A=r[9],E=r[10],O=r[11],t[8]=P*a+A*i+E*M+O*d,t[9]=P*e+A*s+E*h+O*b,t[10]=P*u+A*c+E*l+O*m,t[11]=P*o+A*f+E*v+O*p,P=r[12],A=r[13],E=r[14],O=r[15],t[12]=P*a+A*i+E*M+O*d,t[13]=P*e+A*s+E*h+O*b,t[14]=P*u+A*c+E*l+O*m,t[15]=P*o+A*f+E*v+O*p,t}
MULTMAT4=(t,n,r)=>{t.set((new DOMMatrix(n)).multiply(new DOMMatrix(r)).toFloat32Array());return t}
INVERTMAT4=(v)=>(new DOMMatrix(v)).inverse().toFloat32Array();
LOOKAT=(t,n,r,u)=>{var o=0,i=0,s=0,c=0,f=0,M=0,h=0,l=0,v=0,d=0,b=n[0],m=n[1],p=n[2],P=u[0],A=u[1],E=u[2],O=r[0],R=r[1],y=r[2];if(ABS(b-O)<0.0001&&ABS(m-R)<0.0001&&ABS(p-y)<0.0001)return t;h=b-O,l=m-R,v=p-y,d=1/SQRT(h*h+l*l+v*v),o=A*(v*=d)-E*(l*=d),i=E*(h*=d)-P*v,s=P*l-A*h,(d=SQRT(o*o+i*i+s*s))?(o*=d=1/d,i*=d,s*=d):(o=0,i=0,s=0);c=l*s-v*i,f=v*o-h*s,M=h*i-l*o,(d=SQRT(c*c+f*f+M*M))?(c*=d=1/d,f*=d,M*=d):(c=0,f=0,M=0);return t[0]=o,t[1]=c,t[2]=h,t[3]=0,t[4]=i,t[5]=f,t[6]=l,t[7]=0,t[8]=s,t[9]=M,t[10]=v,t[11]=0,t[12]=-(o*b+i*m+s*p),t[13]=-(c*b+f*m+M*p),t[14]=-(h*b+l*m+v*p),t[15]=1,t}
PERSP=(t,n,r,a,e)=>{var u=1/TAN((n*D2R)/2),o=0;t[0]=u/r,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=u,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,null!=e&&e!==1/0?(o=1/(a-e),t[10]=(e+a)*o,t[14]=2*e*a*o):(t[10]=-1,t[14]=-2*a);return t}
ORTHO=(t,n,r,a,e,u,o)=>{var i=1/(n-r),s=1/(a-e),c=1/(u-o);return t[0]=-2*i,t[5]=-2*s,t[10]=2*c,t[12]=(n+r)*i,t[13]=(e+a)*s,t[14]=(o+u)*c,t}
TRANS3D=(t,n,r)=>{var a=n[0],e=n[1],u=n[2],o=r[3]*a+r[7]*e+r[11]*u+r[15];return o=o||1,t[0]=(r[0]*a+r[4]*e+r[8]*u+r[12])/o,t[1]=(r[1]*a+r[5]*e+r[9]*u+r[13])/o,t[2]=(r[2]*a+r[6]*e+r[10]*u+r[14])/o,t}
PROJ3D=(out,m,a)=>{var ix=a[0],iy=a[1],iz=a[2],ox=m[0]*ix+m[4]*iy+m[8]*iz+m[12],oy=m[1]*ix+m[5]*iy+m[9]*iz+m[13],oz=m[2]*ix+m[6]*iy+m[10]*iz+m[14],ow=m[3]*ix+m[7]*iy+m[11]*iz+m[15];out[0]=(ox/ow+1)/2;out[1]=(oy/ow+1)/2;out[2]=(oz/ow+1)/2;if(out.length>3){out[3]=ow};return out}
//TOVIEWPORT=(out,p)=>{var V=VP_DATA;out[0]=REMAP(p[0],0,1,V[0],V[0]+V[2]);out[1]=REMAP(p[1],1,0,0,V[1]+V[3]);return out}
MAT4xV3=(out, m, a)=>{var x=a[0],y=a[1],z=a[2];out[0]=m[0]*x+m[4]*y+m[8]*z+m[12];out[1]=m[1]*x+m[5]*y+m[9]*z+m[13];out[2]=m[2]*x+m[6]*y+m[10]*z+m[14];return out;}
var VIEW_M4=M4(),PROJ_M4=M4(),VP_M4=M4(),MVP_M4=M4(),/*FPLANES=0,*/CAM_EYE=V3(),CAM_CENTER=V3(),CAM_FRONT=V3(),CAM_RIGHT=V3();
CAMERA=(eye,center,up,fov,a,near,far,ortho)=>{CAM_EYE.set(eye); CAM_CENTER.set(center);SUB(CAM_FRONT,CAM_CENTER,CAM_EYE);NORM(CAM_FRONT,CAM_FRONT);CROSS(CAM_RIGHT,CAM_FRONT,up);NORM(CAM_RIGHT,CAM_RIGHT); LOOKAT(VIEW_M4,eye,center,up);ortho?ORTHO(PROJ_M4,-fov*a,fov*a,-fov,fov,near,far):PERSP(PROJ_M4,fov,a,near,far);MULTMAT4(VP_M4,PROJ_M4,VIEW_M4);/*EXTRACTPLANES(VP_M4)*/}

//WebGL stuff ***********
SHADER = (src,t)=>{
    var sh = gl.createShader(35632+(t||0));
    gl.shaderSource(sh,"#version 300 es\nprecision highp float;\n#define IN uniform\n#define S2D sampler2D\n#define NORM normalize\nin vec3 pos;\n"+(t?"":"out vec4 fragColor;\n")+src);
    gl.compileShader(sh);
    /* THIS CAN BE DELETED */
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      throw `Could not compile WebGL program. \n\n${info}`;
    }
    //*/
    return sh;
  }

var _vs="in vec2 uv;out vec2 _uv;IN mat4 viewp;IN mat4 model;void main(){_uv=uv;gl_Position = viewp*model*vec4(pos,1.0);gl_PointSize=5.0;}"
var _fs="IN vec4 color;void main(){fragColor=color;}"
var _texfs="IN S2D tex;IN vec4 color;void main(){fragColor=color*texture(tex,_uv);}"
var quad_vs="out vec2 _uv;void main(){ _uv=pos.xy*0.5+vec2(0.5);gl_Position=vec4(pos,1.0);}"
var UNIFUNCS={5124:"1i",5125:"1ui",5126:"1f",35664:"2fv",35665:"3fv",35666:"4fv",35676:"Matrix4fv",35678:"1i"}

PROGRAM=(vs,fs,extra=[])=>{
    var extra_str=extra.map(a=>"#define "+a).join("\n")
    var p=gl.createProgram(); gl.attachShader(p,SHADER(extra_str+(vs||_vs),1));gl.attachShader(p,SHADER(extra_str+(fs||_fs),0));gl.linkProgram(p);
    /* THIS CAN BE DELETED */
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(p);
        throw `Could not compile WebGL program. \n\n${info}`;
      }    
    //*/
    //extract all uniforms
    var getp = gl.getProgramParameter.bind(gl)
    var num=getp(p,35718)
    p.unif={},p.attr={}
    for(var i=0;i<num;++i)
    {
        var loc = gl.getActiveUniform(p,i);
        var n=loc.name;n=n.substr(0,n.length-(loc.size>1?3:0))
        loc.loc=gl.getUniformLocation(p,n);
        p.unif[n]=loc;
        loc.func=gl["uniform"+UNIFUNCS[loc.type]].bind(gl)
        loc.set=loc.type==35676?function(v){this.func(this.loc,false,v)}:function(v){this.func(this.loc,v)}
    }
    num=getp(p,35721)
    for(var i=0;i<num;++i)
    {
        var loc = gl.getActiveAttrib(p,i);
        loc.loc=i;
        p.attr[loc.name]=loc;
    }
    p.set=(n,v)=>{p.unif[n].set(v);}
    return p;
}

//const BUFFCOMPS={n:1,uv:2,pos:3,rgba:4,offs:4}
//set num=0 if ELEMENT_ARRAY_BUFFER
BUFFER=(d,num=3,is_inst=0)=>{
    var b=gl.createBuffer()
    var t=34962+(!num?1:0)//gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER;
    if(d.constructor==Array)d=!num?new Uint16Array(d):V3(d);
    (b.update=(v,s=35044)=>{b.d=v||b.d;gl.bindBuffer(t,b);gl.bufferData(t,b.d,s)})(d)//static_draw
    b.bind=(loc)=>{
        gl.bindBuffer(t,b)
        if(loc==null)return
        gl.vertexAttribPointer(loc,num,5126,false,0,0)//gl.FLOAT
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc,is_inst)
    }
    b.map=function(f){this.update(this.d.map(f))}
    b.size=d.length;b.num=num
    return b
}

//the attrib name defines the num of components based on nam elength: pos:3, uv:2, rgba:4, ...
MESH=(d)=>{
    var m={};for(var i in d)if(d[i])m[i]=BUFFER(d[i],i=="tris"?0:i.length)
    m[0]=m.tris?m.tris.size:m.pos.size/3 //total num of primitives
    return m
}


TEX=(w,h,d)=>{
    var t=gl.createTexture()
    var ty=3553
    t.w=w;t.h=h;
    t.bind=function(s){s=s||0;gl.activeTexture(33984+s);gl.bindTexture(3553,t)}
    t.param=function(n,v){this.bind();gl.texParameteri(ty,10240+n,v)}
    t.toVP=function(sh,uni){this.bind();DRAW(QUAD,sh||QUADSHADER,uni||{tex:0})}
    t.mips=()=>{t.bind();gl.generateMipmap(3553)}    
    t.bind()
    gl.texImage2D(ty,0,6408,w,h,0,6408,5121,d||null);
    t.param(0,9729);//mag 9728:NEAREST 9729:LINEAR
    t.param(1,9729);//min 9987:LINEAR_MIPMAP_LINEAR 
    t.param(2,33071);//wraps 33071:clamp_to_edge 10497:gl.REPEAT
    t.param(3,33071);//wrapt
    return t;
}

FBO=(tex)=>{
    var f=gl.createFramebuffer();
    f.tex=tex
    f.w=tex.w;f.h=tex.h;
    var t=36009;//gl.DRAW_FRAMEBUFFER;
    gl.bindFramebuffer(36160,f);
    var depthr = gl.createRenderbuffer();
    gl.bindRenderbuffer( 36161, depthr );
    gl.renderbufferStorage( 36161, gl.DEPTH_COMPONENT24, f.w, f.h );
    gl.framebufferRenderbuffer( t, gl.DEPTH_ATTACHMENT, 36161, depthr );
    gl.framebufferTexture2D( t, gl.COLOR_ATTACHMENT0,3553,tex,0);
    /* THIS CAN BE DELETED */
    var complete = gl.checkFramebufferStatus(t);
	if(complete !== gl.FRAMEBUFFER_COMPLETE) //36054: GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT
		throw("FBO not complete: " + complete);
    //*/
    f.bind=function(v){gl.bindFramebuffer(gl.FRAMEBUFFER,v?f:null);VIEWPORT(0,0,v?this.w:C.width,v?this.h:C.height);return this}
    f.bind(0)
    return f;
}

GLSET=(t,v=1)=>{ v?gl.enable(t):gl.disable(t) }
CLEAR=(c,d)=>{if(c)gl.clearColor(c[0],c[1],c[2],c[3]);gl.clear((c?16384:0)|(d?256:0))}
CULL=2884,ZTEST=2929,BLEND=3042,NEAREST=9728,LINEAR=9729
blendf={alpha:[770,771],add:[770,1]}
BLENDFUNC=(v)=>{var f=blendf[v];gl.blendFunc(f[0],f[1])}
PLANE=(s=1)=>MESH({pos:[-s,0,-s,s,0,s,s,0,-s,s,0,s,-s,0,-s,-s,0,s],uv:[0,0,1,1,1,0, 1,1,0,0,0,1]})
CUBE=(s=1,y=0)=>MESH({pos:[-s,y-s,-s,-s,y-s,s,-s,s+y,-s,-s,s+y,s,s,y-s,-s,s,y-s,s,s,s+y,-s,s,s+y,s],tris:"051045237276567546013032173157024264".split("").map(a=>a|0)})

QUAD=0,QUADSHADER=0,FLATSHADER=0;

DRAW=(mesh,sh,uni,t=4,num_inst=0,insts=0)=>{
    if(!mesh||!mesh[0])return;
    sh=sh||FLATSHADER
    gl.useProgram(sh)
    sh.unif.viewp?.set(VP_M4)
    sh.unif.ceye?.set(CAM_EYE)
    if(uni)
        for(var i in uni)
            sh.unif[i]?.set(uni[i])
    for(var i in mesh)
        if(mesh[i].bind)//only attrs has this value
            mesh[i].bind(sh.attr[i]?.loc)
    if(num_inst){
        for(var i in insts)
            insts[i].bind(sh.attr[i].loc)
        if(mesh.tris) gl.drawElementsInstanced(t,mesh[0],5123,0,num_inst)//Uint16
        else gl.drawArraysInstanced(t,0,mesh[0],num_inst)
    }
    else{
        if(mesh.tris) gl.drawElements(t,mesh[0],5123,0)//Uint16
        else gl.drawArrays(t,0,mesh[0])
    }
}

function _INITGL(){
QUAD=MESH({pos:[-1,-1,0,1,-1,0,1,1,0,-1,-1,0,1,1,-1,-1,1,0]});
QUADSHADER=PROGRAM(quad_vs,"in vec2 _uv;IN S2D tex;void main(){fragColor=texture(tex,_uv);}");
FLATSHADER=PROGRAM(_vs,_fs);
}



/* useful functions that you may want to use
EXTRUDE=(l,h)=>{
    var v=[],s=l.length
    for(var i=0;i<s;i+=2)
        v.push(l[i],h,l[i+1],l[i],0,l[i+1], l[(i+2)%s],h,l[(i+3)%s],l[(i+2)%s],0,l[(i+3)%s])
    return MESH({pos:new F32(v)})
}
*/

