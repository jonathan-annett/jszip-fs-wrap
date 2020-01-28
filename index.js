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
            require("simple-package-wrap").build(__dirname+"/js_zipWrap.js","zipFsWrap");
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
