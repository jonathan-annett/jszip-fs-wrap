(function($N){
$N[0][$N[1]]=(function($N){
/*/home/jonathanmaxannett/jszip-fs-wrap/js_zipWrap.js*/
function zipWrap(zip,nodePath,cb){
    var
    join=nodePath.join,
    trailing_slashes_re=/(\/*)$/g,
    double_slash_re=/(\/\/+)/g,
    double_dot_parent_re=/(?<=\/)([^/]*\/\.\.\/)(?=)/;


    function true_path_from_path(path) {
        // remove traiing backslash from path
        path = path.replace(trailing_slashes_re,'')
        // remove double slashes ie // in path
                   .replace(double_slash_re,'');

        if (["/",""].indexOf(path)>=0) return "/";

        return path[0]==="/" ? path : "/"+path;
    }

    function true_path_from_relative_path(cwd,path) {
        if ([".","",cwd].indexOf(path)>=0) {
            path  = cwd;
        } else {
            if (!path.startsWith("/")) {
                if (path.startsWith("./")) {
                    path = join(cwd,path.substr(2));
                } else {
                    path = join(cwd,path);
                }
            }
        }

        // remove traiing backslash from path
        path = path.replace(trailing_slashes_re,'')
        // remove double slashes ie // in path
                   .replace(double_slash_re,'')
        // resolve the first .. parent dir fixup (if present)
                   .replace(double_dot_parent_re,'');

        // resolve any more parent dir fixups
        while (path.search(double_dot_parent_re)>=0)
            path =path.replace(double_dot_parent_re,'');


        return path === ""  ? "/" : path;

    }

    function ab2str(buf) {
          return String.fromCharCode.apply(null, new Uint16Array(buf));
        }

    function str2ab(str) {
      var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
      var bufView = new Uint16Array(buf);
      for (var i=0, strLen=str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    }

    var wrap = {};

    // since we are "managing" the zip, we can maintain our own directory
    // to speedup and facilitate watching etc
    var zip_fns=[];// what the zip object calls the file
    var listing=[];// the file name in our virtual fs (under "/")
    var directory = {};
    var watchers  = {};
    var inodes = {};
    var getInode = function getInode(true_path){
        var result = inodes[true_path];
        if (!result) {
            result = getInode.next || 1000;
            getInode.next = result+1;
            inodes[true_path] = result;
        }
        return result;
    };
    var cwd = "/" ;
    var cwd_view  = wrap;

    var properties;

    function utf8Encoding(str) {return str;}
    var bufferEncoding = typeof process==='object'&&typeof Buffer==='function'? function bufferEncoding(str){return Buffer.from(str);} : str2ab;

    reread();

    properties = getProperties();

    Object.defineProperties(wrap,properties);

    if (typeof cb==='function') {
        var

        file_list = wrap.get_files(true),
        bytes=0,
        loading = file_list.map(function(fn){
            //console.log({loading:fn});
            wrap.string[fn](function(err,data){

            //console.log(err?{error:err.messsage,fn:fn}:{loaded:fn,bytes:data.length});

            var ix=loading.indexOf(fn);
            loading.splice(ix,1);
            bytes += err ? 0 : data.length;
            if (loading.length===0) {
                return cb(wrap,bytes);
            }
        });
            return fn;
        });
    }

    return wrap;

    function reread(){

        zip_fns.splice.apply(zip_fns,[0,zip_fns.length].concat(Object.keys(zip.files)));// what the zip object calls the file
        listing.splice.apply(listing,[0,listing.length].concat(zip_fns.map(true_path_from_path)));// the file name in our virtual fs (under "/")

        // ensure each file has an inode, and retire any stale inodes
        var current_inodes = listing.map(getInode);
        Object.keys(inodes).forEach(function(fn){
            var inode = inodes[fn];
            if (current_inodes.indexOf(inode)<0) {
                delete inodes[fn];
            }
        });

        // build zip_fns to listing map (lives in 'directory')
        Object.keys(directory).forEach(function(fn){delete directory[fn];});
        zip_fns.forEach(function(zip_fn,ix){
           directory[ listing[ix] ]=zip_fn;
        });

        // helper function fetch the internal object for a file, from either true_path or zip_fn
        // eg get_object("/myfile.js")===get_object("myfile.js")
        // eg get_object("dir/mysubdir") === get_object("/dir/mysubdir") === get_object("dir/mysubdir/")===get_object("/dir/mysubdir/")
    }

    function get_object(path) {
        // since zip.files [ directory[true_path] ] ---> object
        // and zip.files [ zip_fn ] ---> object
        // and true_path_from_path(zip_fn) ---> true_path
        // and true_path_from_path(true_path) ---> true_path
        // we can assume the following
        return zip.files[ directory[ true_path_from_path(path) ] ];
    }

    function file_proxy(dtype,opts) {
        var
        cache_name = "__cache_"+dtype,
        get_cache = function (obj) {
            // first try type asked for
            if (obj[cache_name]) return obj[cache_name];

            // now see if we can convert from another type
            if (obj.__cache_string && dtype==="arraybuffer") {
                obj.__cache_arraybuffer = str2ab(obj.__cache_string);
                return obj.__cache_arraybuffer;
            }
            if (obj.__cache_arraybuffer && dtype==="string") {
                obj.__cache_string = ab2str(obj.__cache_arraybuffer);
                return obj.__cache_string;
            }
        },
        set_cache = function (obj,data) {
            // when setting, clear all cached types first, so we don't have legacy issues
            delete obj.__cache_string;
            delete obj.__cache_arraybuffer;
            obj[cache_name]=data;
            return data;
        };
        return {
                   get : function (x,path) {
                       var errpath=path;
                       path = path.replace(/\$_/g,'.').replace(/\$/g,'/');
                       var
                       true_path = true_path_from_relative_path(cwd,path),
                       zip_fn = directory[true_path],
                       obj=zip.files[zip_fn];
                       if (obj&&obj.async) {
                            if (obj.dir) {
                                throw new Error("not a file:"+errpath+" ( "+path+" ) is a directory");
                            } else {
                                var try_cache=function() {
                                    var data = get_cache(obj);
                                    if (data) {
                                        // we don't need to decompress
                                        // because we either just read or wrote it
                                        // note whilst the zib object also maintains a cache on write, it does
                                        // not do so on read.
                                        // also, when writing, it keeps reference to same object
                                        // so there is no memory overhead by caching it twice.
                                        return function (cb) {
                                            return cb?cb(null,data):data;
                                        };
                                    }
                                    return false;
                                };

                                var cacheAvail = try_cache();
                                if (cacheAvail) return cacheAvail;

                                if (obj.__pending) {
                                    return function (cb) {
                                        return not_ready_yet(cb);
                                    };
                                }

                                obj.__pending = [];

                                var
                                resolve = function (data){
                                    set_cache(obj,data);
                                    if (obj.__pending) {
                                        obj.__pending.forEach(function(cb){
                                            cb(null,data);
                                        });
                                        obj.__pending.splice(0,obj.__pending.length);
                                        delete obj.__pending;
                                    }
                                },
                                reject  = function(newErr) {
                                    if (obj.__pending) {
                                        obj.__pending.forEach(function(cb){
                                            cb(newErr);
                                        });
                                        obj.__pending.splice(0,obj.__pending.length);
                                        delete obj.__pending;
                                    }
                                };
                                obj.async(dtype).then(resolve).catch(reject);

                                return not_ready_yet;




                            }
                       } else {
                           // create the error object early
                           var err = new Error("not found:"+errpath+" ( "+path+" )");
                           return function (cb) {
                              if (typeof cb==='function') {
                                  return cb(err);
                              } else {
                                  throw err;
                              }
                           };
                       }

                       function not_ready_yet(cb) {
                           var cacheAvail = try_cache();
                           if (cacheAvail) return cacheAvail(cb);

                           if (cb) {
                               if (obj.__pending) {
                                   return obj.__pending.push(cb);
                               }
                               cb (new Error("internal read error"));
                           } else {
                               if (obj.__pending) {
                                   err = new Error(path+" not ready. retry later");
                                   err.data=null;
                                   err.busy=true;
                                   err.code="ENOTREADY";
                                   obj.__pending.push(function(data){
                                       err.data=data;
                                       err.busy=false;
                                   });
                                   throw err;
                               } else {
                                   throw new Error("internal read error");
                               }
                           }
                       }
                   },
                   set : function (x,path,data) {
                       var errpath=path;
                       path = path.replace(/\$_/g,'.').replace(/\$/g,'/');

                       var
                       watch_messages,
                       true_path = true_path_from_relative_path(cwd,path),
                       zip_fn = directory[true_path],
                       obj=zip.files[zip_fn];

                       if (obj&&obj.async) {
                            //  updating an existing file
                            watch_messages=["change"];
                       } else {
                           // creating a new file
                           zip_fn = true_path.substr(1);
                           directory[true_path]=zip_fn;
                           zip_fns.push(zip_fn);
                           listing.push(true_path);
                           watch_messages=["rename","change"];
                       }

                       zip.file(zip_fn,data,opts);
                       set_cache(zip.files[zip_fn],data);
                       if (!(obj&&obj.async)) obj=zip.files[zip_fn];

                       var
                       inode = getInode(true_path),
                       basename = nodePath.basename(true_path),
                       notify = function(watch_path){
                           if(watchers[watch_path]){
                              watch_messages.forEach(function(watch_message){
                                  watchers[watch_path].forEach(
                                      function(fn){fn(watch_message,fn.encode(basename),new wrap.Stats(data.length, obj.date,inode));}
                                  );
                              });
                           }
                       };

                       notify(true_path);
                       notify(nodePath.dirname(true_path));

                       return true;
                   }
               };
    }

    function isFile( zip_fn ) {
        var obj = get_object(zip_fn);
        if (!obj) console.log({isFile_undefined:zip_fn});

        return !!obj && !obj.dir;
    }

    function isDir( zip_fn ) {
        var obj = get_object(zip_fn);
        if (!obj) console.log({isDir_undefined:zip_fn});

        return !!obj && obj.dir;
    }

    function isUnique ( str, ix, arr) {
        return arr.indexOf(str)===ix;
    }

    function addWatcher (path,options,listener) {
        if (typeof path !=='string') {
            if (typeof path !=='object' &&
                typeof path.constructor.name==='string' &&
                       path.constructor.name.endsWith('Buffer') ) {
                path = path.toString('utf8');
            } else {
                throw new Error ("expecting a string or buffer for path");
            }
        }


        if (typeof options==='function' ) {
            listener = options;
            options = {};
        }

        if (typeof listener !=='function') {


        }

        if (options.encoding) {
            listener.encode=['utf8','utf-8'].indexOf(options.encoding)>=0?utf8Encoding:bufferEncoding;
        } else {
            listener.encode = utf8Encoding;
        }

        var
        true_path = true_path_from_relative_path(cwd,path),
        listeners = [],
        notify_listeners = function(ev,file){
             listeners.forEach(function(fn){
                 fn(ev,file);
             });
        },
        watcher = {
        },
        watch_stack = watchers[true_path] || (watchers[true_path]=[]);

        watch_stack.push(notify_listeners);

        return Object.defineProperties(watcher,{
            close : {
                value : function () {
                    var index = watch_stack.indexOf(notify_listeners);
                    if (index>=0) {
                        watch_stack.splice(index,1);
                        if (watch_stack.length===0) {
                            delete watchers[true_path];
                        }
                    }
                }
            },
            addListener : {
                value: function (listener) {
                    if (typeof listener !=='function') {
                        throw new Error("invalid arg type");
                    }
                    listeners.add(listener);
                }
            },
            removeListener : {
                value : function (listener) {
                    var ix = listeners.indexOf(listener);
                    if (ix>=0) {
                        listeners.splice(ix,1);
                    }
                }
            }
        });
    }

    function filtered_always   (file)  {return true;}
    function filtered_root_path (file) {return file.substr(1).indexOf("/")<0;}
    function filtered_top_root_object (obj) {
        return filtered_root_path(true_path_from_path(obj.name).substr(1));
    }

    function filtered_top_path (file)  {return file.indexOf("/")<0;}

    function filtered_top_object_under(under) {
        var
        mine_true = true_path_from_path(under),
        mine_from = mine_true=== "/"?1 : mine_true.length+1;
        return function filtered_top_object (obj) {return filtered_top_path(true_path_from_path(obj.name).substr(mine_from));};
    }

    // view_chdir returns a view of the wrapped zip, with MOST of the methods,
    // but rooted under s specific path
    // specifying recursive as true will mean affect the format of the listing and files and dirs arrays
    // (ie any subdirectories and files are included as full paths relative to the root)
    // not specifying recursive (or supplying a falsey value) will mean mean only
    // the top level files and dirs are included in listing, only top level dirs in dirs, and files in files
    /* eg given a zip with

        /dir0/dir1/subdir1/file1.ext
        /dir0/file2.ext

                 view_chdir("/dir0",{recursive:true})     vs view_chdir("/dir0")

     listing === [ "dir1/subdir1/file1.ext","file2.ext" ] vs [ "dir1","file2.ext" ]
     dirs    === [ "dir1/subdir1" ]                       vs [ "dir1" ]
     files   === [ "dir1/subdir1/file1.ext","file2.ext" ] vs [ "file2.ext" ]

    */

    function view_chdir(path,recursive) {

        var true_path =true_path_from_path(path);

        //if (true_path==="/") return wrap;

        if (true_path!=="/" && !zip.files[ directory[ true_path ] ]) {
            throw new Error (path+" not found");
        }

        var

        view={},

        my_true_path_prefix = true_path==="/" ? "/" : true_path+"/",
        mine_from           = my_true_path_prefix.length,

        filtered        = !!recursive ? filtered_always : filtered_top_path,

        filtered_object = !!recursive ? filtered_always : filtered_top_object_under(true_path);

        return Object.defineProperties(view,getViewProperties() );

        function GET(what){return properties[what].get(filtered_always);}

        function make_mine (path) {

            if (path.startsWith("..")) return "///badpath!";

            var mine = path.replace(/^(\.|\/)*/,my_true_path_prefix);
            return mine;

        }

        function my_part (path) {
            return path.substr(mine_from);
        }

        function is_my_true_path(fn) {
            return fn.startsWith(my_true_path_prefix);
        }

        function is_my_object(obj) {
            return true_path_from_path(obj.name).startsWith(my_true_path_prefix);
        }

        function listing_view (filterMode) {
            return listing.filter(is_my_true_path).map(my_part).filter(filterMode||filtered);
        }

        function files_view (filterMode) {
            return GET("files").filter(is_my_true_path).map(my_part).filter(filterMode||filtered);
        }

        function dirs_view (filterMode) {
            return GET("dirs").filter(is_my_true_path).map(my_part).filter(filterMode||filtered);
        }

        function listing_objects_view () {
            return GET("listing_objects").filter(is_my_object).filter(filtered_object);
        }

        function files_objects_view () {
            return GET("files_objects").filter(is_my_object).filter(filtered_object);
        }

        function dirs_objects_view () {
            return GET("dirs_objects").filter(is_my_object).filter(filtered_object);
        }

        function file_proxy_view(name) {
            var parent_proxy = properties[name].value;
            return new Proxy({},{
                get : function (x,path) {
                    return parent_proxy[ make_mine(path) ];
                },
                set : function (x,path,data) {
                    parent_proxy[ make_mine(path) ]=data;
                    return true;
                }
            });

        }

        function getViewProperties() {

            return augmentProps(
                      ["listing","files","dirs"],
                      ["mkdir","mkdirp","rmdir","rm","exists","stat","mv","cp"],
                      true_path,
                      {
                       get_listing     : { value : function(recursive){ return ; } },
                       listing         : { get : listing_view },
                       files           : { get : files_view },
                       dirs            : { get : dirs_view },
                       listing_objects : { get : listing_objects_view },
                       files_objects   : { get : files_objects_view },
                       dirs_objects    : { get : dirs_objects_view },

                       string          : { value : file_proxy_view("string")},
                       arraybuffer     : { value : file_proxy_view("arraybuffer")},
                       object          : { value : function subview_object (path) {
                                                       return zip.file( directory [ make_mine(path) ]  );
                                                   }},
                       addWatcher      : { value : function addWatcher (path,options,listener)  {
                                               return addWatcher (make_mine(path),options,listener);
                       }},
                       view_dir        : { value : function view_dir(path,recursive) {
                                               return view_chdir(make_mine(path),recursive);
                                           }
                       },
                       chdir           : {
                           value : function chdir(path) {
                               wrap.chdir(true_path_from_relative_path(true_path,path));
                           }
                       },
                       reread          : {
                           value : reread
                       },
                       toJSON          : {
                           value : function() {
                               var
                               j = { dirs : {}, files:{}},
                               dirs=view.dirs,
                               files=view.files;

                               dirs.forEach(function(dir){
                                   j.dirs[dir] = view.view_dir(dir).toJSON();
                               });
                               files.forEach(function(fn,ix){
                                   j.files[fn]=view.string[fn]();
                                   j.dirs[fn] = {
                                       date    : view.files_objects[ix].date,
                                       size    : j.files[fn].size
                                   };
                               });
                               return j;
                           }
                       },
                   });
        }


    }

    function augmentProps(recursive,pathwraps,true_path,props) {

        var
        path_fixer = true_path_from_relative_path.bind(this,true_path),
        cpArgs = (function(s) { return s.call.bind(s); })(Array.prototype.slice);

        recursive.forEach(add_getters);
        pathwraps.forEach(add_parent_wrap);

        return props;

        function add_getters(cmd){
            props["get_"+cmd] = {
                value : function(recursive) {
                    return props[cmd].get(recursive?filtered_always:undefined);
                },
                enumerable:false,
                configurable:true,
            };
            props[cmd].enumerable=true;
            props[cmd].configurable=true;
        }



        function add_parent_wrap(cmd){
            var

            parent_handler = wrap[cmd],
            child_handler = {};// wrapper to ensure child_handler gets namded cmd

            child_handler[cmd]=function () {
                var
                args = cpArgs(arguments),
                cb = args[args.length-1];

                if (typeof cb==="function") args.pop();
                args =args.map(path_fixer);
                if (typeof cb==="function") args.push(cb);

                return parent_handler.apply(this,args);
            };

            props[cmd]={
                value : child_handler[cmd],
                enumerable:true,
                configurable:true,
            };

        }
    }

    function getProperties() {


        var

        listing_true_path_filter = filtered_root_path,
        listing_object_filter    = filtered_top_root_object;


        function errback (cb,err,data) {
            if (err) {
                if (cb) return cb(err);
                throw (err);
            } else {
                return cb ? cb(null,data) : data;
            }
        }


        function exists(true_path) {
            return !!zip.files [ directory [ true_path ] ];
        }

        function isDir(true_path) {
            var entry = zip.files [ directory [ true_path ] ];
            return entry && entry.dir;
        }

        function isEmptyDir(true_path) {
            if (!isDir(true_path)) return false;
            return (view_chdir(true_path).length===0);
        }


        function mkdir (path,cb) {

            var
            true_path = true_path_from_relative_path(cwd,path);
            if ( true_path === "/" || zip.files [ directory [ true_path ] ] ) {
                return errback(cb,new Error("can't mkdir "+path + "already exists" +

                    (zip.files [ directory [ true_path ] ].dir?"":" (a file)")
                ));
            }
            var
            parent_path = nodePath.dirname(true_path),
            parent_dir = zip.files [ directory [ parent_path ] ];
            if ( parent_path === "/"  || parent_dir ) {
                 if ( parent_path === "/" || parent_dir.dir ) {
                     var zip_fn=true_path.substr(1);
                     zip.folder(zip_fn);
                     reread();
                     return errback(cb);
                 } else {
                     return errback(cb,new Error ("can't mkdir '"+path+"' - '"+parent_dir.name + "' is not a directory"));
                 }
             } else {
                 return errback(cb,new Error ("can't mkdir '"+path+"' - '"+parent_path + "' not found"));
             }


        }

        function mkdirp (path,cb) {

            var true_path = true_path_from_relative_path(cwd,path);
            if ( zip.files [ directory [ true_path ] ] ) {
                return errback(cb,new Error("can't mkdir "+path + "already exists" +

                    (zip.files [ directory [ true_path ] ].dir?"":" (a file)")
                ));
            }
            var zip_fn=true_path.substr(1);
            zip.folder(zip_fn);
            reread();
            return errback(cb);


        }



        function rm (path,cb) {
            var
            true_path = true_path_from_relative_path(cwd,path);
            if (!!zip.files [ directory [ true_path ] ]) {
                zip.remove(directory [ true_path ]);
                reread();
                return errback(cb);
            } else {
                return errback(cb,new Error(path+" not found"));
            }
        }

        function rmdir (path,cb) {
            var
            true_path = true_path_from_relative_path(cwd,path);

            if (exists(true_path)){
                if (isDir(true_path)) {
                    if (isEmptyDir(true_path)) {
                        return rm (path,cb);
                    } else {
                        return errback(cb,new Error(path+" is not empty"));
                    }
                } else {
                    return errback(cb,new Error(path+" is not a directory"));
                }
            } else {
                return errback(cb,new Error(path+" not found"));
            }
        }


        function do_exists(path,cb){
            var
            true_path = true_path_from_relative_path(cwd,path),
            answer = true_path === "/" || exists(true_path);
            return cb ? cb (answer) : answer;
        }


        function Stats(size, when,inode) {
          this.ino=inode;
          this.size = size;
          this.atimeMs = when.getTime();
          this.mtimeMs = this.atimeMs;
          this.ctimeMs = this.atimeMs;
          this.birthtimeMs = this.atimeMs;
          this.atime = when;
          this.mtime = this.atime;
          this.ctime = this.atime;
          this.birthtime = this.atime;
        }

        function stat(path,cb) {
            var
            true_path = true_path_from_relative_path(cwd,path);

            if (exists(true_path)){

                var
                zip_fn = directory [ true_path],
                ino = getInode(true_path),
                obj = zip.file ( zip_fn );
                if (obj) {

                    if (obj._data && typeof obj._data.uncompressedSize === 'number') {
                        return errback(cb,null,new Stats(obj._data.uncompressedSize, obj.date,ino));
                    }  else {

                        if (cb) {
                            obj.async("string").then(function(data){
                                return errback(cb,null,new Stats(data.length, obj.date,ino));
                            }).catch(function(err){
                                return errback(cb,err);
                            });
                        } else {
                            var ignore=function(){};
                            obj.async("string").then(ignore).catch(ignore);
                            return errback (undefined,new Error(path+" not ready. try later"));
                        }
                    }

                } else {
                    return errback (cb,new Error(path+" not found"));
                }
            }

        }

        function cp (src,dest,cb,_is_mv) {
            var
            true_src  = true_path_from_relative_path(cwd,src),
            true_dest = true_path_from_relative_path(cwd,dest);


            if (exists(true_src)){

                if (true_src===true_dest) {
                    return errback(cb,new Error("source and destination are the same"));
                }

                var zip_fn_src = directory [true_src];

                if (exists(true_dest)){

                    var zip_fn_dest = directory [true_src];

                    if (isDir(true_dest)){
                        return errback(cb,new Error(dest+" is a directory. mv failed"));
                    }

                    // trash the existing file/dir tree that is in the zip
                    zip.remove(zip_fn_dest);
                    // reuse existing dest name that was in zip
                    return do_mv(zip_fn_src,zip_fn_dest);

                } else {
                    // invent a dest name (eg true without leading slash)
                    return do_mv(zip_fn_src,true_dest.substr(1));
                }

            } else {
                return errback (cb, new Error(src+" not found"));
            }

            function do_mv_file(zip_fn_src,zip_fn_dest) {
                if (cb) {

                    wrap.arraybuffer[true_src](function(err,data){
                        if (err) return errback(cb,err);
                        wrap.arraybuffer[true_dest] = data;
                        if (_is_mv) zip.remove(zip_fn_src);
                        reread();
                        return cb(null);
                    });

                } else {
                    // this may throw if src is still compressed - them's the break with sync ops.
                    wrap.arraybuffer[true_dest] = wrap.arraybuffer[true_src]();
                    if (_is_mv) zip.remove(zip_fn_src);
                    reread();
                }
            }

            function do_mv_dir(zip_fn_src,zip_fn_dest) {

                var
                dir_to_move = wrap.view_dir(true_src,true),
                files_to_move;
                if (cb) {

                    files_to_move = files_to_move = dir_to_move.files_objects;
                    var

                    source_files  = files_to_move.map(function(obj){
                        return true_path_from_path (obj.name);
                    }),
                    offset = true_src.length+1,
                    dest_files  = source_files.map(function(fn){
                        return true_dest + "/" + fn.substr(offset);
                    });

                    Promise.all(

                        files_to_move.map(function(obj,ix){
                            return obj.async("arraybuffer").catch(function(err){
                                                               return err;
                                                           });
                        })

                    ).then(function(buffers){

                        var errors = buffers.filter(function(buf){
                            return typeof buf==='object'&&buf.constructor===Error;
                        });

                        if (errors.length>0){

                            var err = new Error("errors while reading source files");
                            err.errors = errors;
                            return cb(err);

                        } else {

                            buffers.forEach(function(buf,ix){
                                var zip_dest = directory [ dest_files[ix] ] || dest_files[ix].substr(1);
                                zip.file( zip_dest  ,buf , {binary:true} );
                            });

                            if (_is_mv) zip.remove(zip_fn_src);

                            reread();

                            return cb();
                        }



                    }).catch (function(err ){
                        console.log({err:err});
                    });



                } else {
                    // get files to move as an array of relative paths
                    files_to_move = dir_to_move.files;
                    var moved_ok=[];
                    // attempt to move each file - if any are still compresed, this will throw
                    try {

                        files_to_move.forEach(function(fn){
                            var true_path_src  = true_src  +"/" + fn;
                            var true_path_dest = true_dest +"/" + fn;
                            wrap.arraybuffer[true_path_dest] = wrap.arraybuffer[true_path_src]();
                            moved_ok.push(true_path_dest);
                        });

                         // ok all files copied ok, so we can trash the orignal files and we a re done
                        if (_is_mv) zip.remove(zip_fn_src);

                        // clear the moved list, as we don't want to rollback the move
                        moved_ok.splice(0,moved_ok.length);

                    } finally {
                        moved_ok.forEach(function(true_fn){
                            zip.remove( directory [true_fn] );
                        });
                        reread();
                    }
                }
            }

            function do_mv(zip_fn_src,zip_fn_dest) {
                if (isDir(true_src)) {
                    return do_mv_dir(zip_fn_src,zip_fn_dest);
                } else {
                    return do_mv_file(zip_fn_src,zip_fn_dest);
                }
            }

        }

        function mv (src,dest,cb,_is_mv) {
            return cp (src,dest,cb,true);
        }


        return augmentProps(
            ["listing","files","dirs"],
            [],'',
            {

            recursive       : {
                get : function () {
                    return listing_true_path_filter === filtered_always;
                },
                set : function (value) {
                    listing_true_path_filter = value ? filtered_always : filtered_root_path;
                    listing_object_filter    = value ? filtered_always : filtered_top_root_object;
                }
            },

            listing         : {
                get : function (filtermode) {
                    return listing.filter(filtermode||listing_true_path_filter);
                },
            },// filesnames in the zip, adjusted to be based under /
            files           : {
                get : function (filtermode) {
                    return listing.filter(filtermode||listing_true_path_filter)
                       .filter(isFile);
                },
            },// listing with dirs removed
            dirs            : {
                get : function (filtermode) {
                    return listing.filter(filtermode||listing_true_path_filter)
                        .filter(isDir);

                },
            },// listing with files removed

            mkdir           : { value : mkdir},
            mkdirp          : { value : mkdirp},
            rmdir           : { value : rmdir},
            rm        : { value : rm },

            exists          : { value : do_exists},

            stat            : { value : stat },

            mv              : { value : mv },
            cp              : { value : cp },

            listing_objects : {
                get : function (filtermode) {
                    return listing.filter(filtermode||listing_true_path_filter)
                        .map(get_object);
                },
            },// array of zipObjects, index mapped to listing
            files_objects   : {
                get : function (filtermode) {
                    return listing.filter(filtermode||listing_true_path_filter)
                       .filter(isFile)
                         .map(get_object);
                },
            },// array of zipObjects, index mapped to files
            dirs_objects    : {
                get : function (filtermode) {
                    return listing.filter(filtermode||listing_true_path_filter)
                        .filter(isDir)
                          .map(get_object);
                },
            },// array of zipObjects, index mapped to dirs
            string          : {
                value : new Proxy ({},file_proxy("string"))
            },// proxy accessor
            arraybuffer     : {
                value : new Proxy ({},file_proxy("arraybuffer",{binary:true}))
            },
            object          : {
                value : function (path) {
                    return zip.file( directory [ true_path_from_path(path) ]  );
                }
            },
            addWatcher      : {
                value : addWatcher
            },
            view_dir        : {
                value : function view_dir(path,recursive){
                    return view_chdir(path,recursive);
                }
            },
            chdir           : {
                value : function chdir(path) {
                    var new_path = true_path_from_relative_path(cwd,path);
                    cwd_view = view_chdir(new_path);
                    // note - if view_chdir() throws (ie bad path) we don't update either cwd or cwd_view
                    // this is "by design"
                    cwd = new_path;
                }
            },
            reread          : {
                value : reread,
            },
            toJSON          : {
                value : function() {
                    var j = {
                        dir   : getDir(wrap),
                        files : getFiles(wrap)
                    };

                    function getDir(z) {
                        var r={};
                        z.get_dirs(false).forEach(function(d){
                            r[d.replace(/^\/{1}/,'')]=getDir(z.view_dir(d,false));
                        });

                        z.files_objects.forEach(function(f){
                            r[nodePath.basename(f.name)]=f.date;
                        });
                        return r;
                    }

                    function getFiles(z) {
                        var r={};
                        z.get_files(true).forEach(function(f){
                            var obj = zip.files[ directory [f] ];
                            r[f]={
                                size:obj._data.uncompressedSize,
                                text:z.string[f]()
                            };
                        });
                        return r;
                    }

                    return j;
                }
            },

            //util exports

            ab2str                       : {value : ab2str},
            str2ab                       : {value : str2ab},
            trailing_slashes_re          : {value : trailing_slashes_re},
            double_slash_re              : {value : double_slash_re},
            double_dot_parent_re         : {value : double_dot_parent_re},
            true_path_from_path          : {value : true_path_from_path},
            true_path_from_relative_path : {value : true_path_from_relative_path},
            Stats                        : {value : Stats},
        });

    }

}

return  zipWrap;
})(!$N[0].Document);

})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,'exports']:[window,'zipFsWrap']);
