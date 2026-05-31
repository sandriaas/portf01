import{w as a,q as i,p as e,M as f,L as c,S as p,O as d,t as l,i as u}from"./chunk-EPOLDU6W-2aTxbjFE.js";const g="/cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/assets/index-BxNsuFNe.css",s="G-WG68HKXTX6";function m(){return[{rel:"icon",type:"image/png",sizes:"32x32",href:"/favicons/11/favicon-32x32.png",id:"favicon-32"},{rel:"icon",type:"image/png",sizes:"16x16",href:"/favicons/11/favicon-16x16.png",id:"favicon-16"},{rel:"apple-touch-icon",sizes:"180x180",href:"/favicons/11/apple-touch-icon.png",id:"apple-touch-icon"},{rel:"preload",href:"/fonts/AntiqueLegacy-Regular.woff2",as:"font",type:"font/woff2",crossOrigin:"anonymous"},{rel:"preload",href:"/fonts/AntiqueLegacy-Medium.woff2",as:"font",type:"font/woff2",crossOrigin:"anonymous"},{rel:"preload",href:"/fonts/AntiqueLegacy-Light.woff2",as:"font",type:"font/woff2",crossOrigin:"anonymous"},{rel:"preload",href:"/fonts/FragmentMono-Regular.woff2",as:"font",type:"font/woff2",crossOrigin:"anonymous"},{rel:"stylesheet",href:g}]}function y({children:r}){return e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx("meta",{name:"viewport",content:"width=device-width, initial-scale=1.0, viewport-fit=cover"}),e.jsx("meta",{name:"theme-color",content:"#ffffff"}),e.jsx(f,{}),e.jsx(c,{})]}),e.jsxs("body",{children:[e.jsx("div",{id:"root",children:r}),e.jsx(p,{}),e.jsx("script",{dangerouslySetInnerHTML:{__html:`(function() {
        var total = 13;
        var pick = Math.floor(Math.random() * total) + 1;
        var link32 = document.getElementById('favicon-32');
        for (var i = 1; i <= total; i++) {
          new Image().src = '/favicons/' + String(i).padStart(2, '0') + '/favicon-32x32.png';
        }
        var order = [];
        for (var i = 1; i <= total; i++) { if (i !== pick) order.push(i); }
        for (var i = order.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
        }
        order.push(pick);
        var step = 0;
        var baseDelay = 40;
        function next() {
          if (step >= order.length) return;
          var n = String(order[step]).padStart(2, '0');
          link32.href = '/favicons/' + n + '/favicon-32x32.png';
          step++;
          if (step < order.length) {
            var t = baseDelay + (step * step);
            setTimeout(next, t);
          } else {
            var p = '/favicons/' + n + '/';
            document.getElementById('favicon-16').href = p + 'favicon-16x16.png';
            document.getElementById('apple-touch-icon').href = p + 'apple-touch-icon.png';
          }
        }
        setTimeout(next, 300);
      })();`}})]})]})}const v=a(function(){return e.jsx(d,{})}),x=i(function(){const t=l();let o="Unknown error",n=500;return u(t)?(o=t?.data?.message??t.data,n=t.status):t instanceof Error&&(o=t.message),e.jsxs("div",{style:{padding:"2rem",fontFamily:"system-ui"},children:[e.jsx("h1",{children:"Oops"}),e.jsx("h2",{children:n}),e.jsx("pre",{children:o})]})});export{x as ErrorBoundary,y as Layout,v as default,m as links};
