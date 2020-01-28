function packageTemplate(){(function(x){x[0][x[1]]=(function acme_package(){})();})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"${acme}"]);}
Object.defineProperties(module.exports,{
    zipWrap  : {

        get : function () {
            delete module.exports.zipWrap;
            Object.defineProperties(module.exports,{
                zipWrap :  {
                    value : require("./js_zipWrap.js")(),
                    configurable : true,
                    enumerable : true
                }
            });
            return module.exports.zipWrap;
        },
        configurable : true,
        enumerable : true
    },
    src      : {

        get : function () {

            delete module.exports.src;
            Object.defineProperties(module.exports,{
                src :  {
                    value :
                    require("fs").readFileSync("./js_zipWrap.pkg.js","utf8"),
                    configurable : true,
                    enumerable : true
                }
            });
            return module.exports.src;
        },
        configurable : true,
        enumerable : true

    },
    min      : {

        get : function () {

            delete module.exports.min;
            Object.defineProperties(module.exports,{
                min :  {
                    value :
                    require("fs").readFileSync("./js_zipWrap.min.js","utf8"),
                    configurable : true,
                    enumerable: true
                }
            });
            return module.exports.min;
        },
        configurable : true,
        enumerable : true

    },
    src_path : {
        value : __dirname +"/js_zipWrap.pkg.js",
        configurable : false,
        enumerable : true
    },
    min_path : {
        value : __dirname +"/js_zipWrap.min.js",
        configurable : false,
        enumerable : true
    },
    build : {
        value : function () {

            var path = require("path"),
            fs =require("fs"),
            UglifyJS     = require("uglify-js"),
            babel = require("babel-core"),
            minifyJS = function minifyJS( js_src ) {
               var result= UglifyJS.minify(js_src, {
                   parse: {},
                   compress: {},
                   mangle: false,
                   output: {
                       code: true
                   }
               });
               if (result.code) return result.code;

               result = babel.transform(js_src,{minified:true});


              return result.code;
            };


            var js_zipWrap_js = fs.readFileSync("./js_zipWrap.js","utf8");
            js_zipWrap_js = makePackage("zipWrap",js_zipWrap_js);
            fs.writeFileSync("./js_zipWrap.pkg.js",js_zipWrap_js);
            js_zipWrap_js = minifyJS(js_zipWrap_js);
            fs.writeFileSync("./js_zipWrap.min.js",js_zipWrap_js);

            function makePackage(name,pkg_fn){

                var pkg_bare = pkg_fn.toString().trimEnd();

                var template = packageTemplate.toString().trimEnd();
                template = template.substring(template.indexOf('{')+1,template.length-1).trim().split('function acme_package(){}');
                template.push(template.pop().split('${acme}').join(name));

                return template.join(('function()'+pkg_bare.substring(pkg_bare.indexOf('{'))));
            }



        }
    }
});
if (process.mainModule===module) {

    if (process.argv.indexOf("--build")>0) {
        module.exports.build();
        console.log(module.exports);
    } else {
        if (process.argv.indexOf("--info")>0) {
            console.log(module.exports);
        } else {
            if (process.argv.indexOf("--src")>0) {
                console.log(module.exports.src);
            } else {
                  if (process.argv.indexOf("--min-src")>0) {
                      console.log(module.exports.min);
                  }
              }
        }

    }
}
