/*!
 * CamanJS - Pure HTML5 Javascript (Ca)nvas (Man)ipulation
 * http://camanjs.com/
 *
 * Copyright 2011, Ryan LeFevre
 * Licensed under the new BSD License.
 * See LICENSE for more info.
 *
 * Project Contributors:
 *   Rick Waldron - Plugin Architect and Developer
 *    Twitter: @rwaldron
 *    GitHub: http://github.com/rwldrn
 *
 *   Cezar Sa Espinola - Developer
 *    Twitter: @cezarsa
 *    GitHub: http://github.com/cezarsa
 */
 
/*global Caman: true */
(function () {

var forEach = Array.prototype.forEach,
hasOwn = Object.prototype.hasOwnProperty,
slice = Array.prototype.slice,

// Helper function since document.getElementById()
// is a mouthful. Note that this will not conflict
// with jQuery since this $ variable does not exist
// in the global window scope.
$ = function (id) {
  if (id.substr(0, 1) == '#') {
    id = id.substr(1);
  }
  
  return document.getElementById(id);
},

Caman = function () {
  if (arguments.length == 1) {
    // 1 argument = init image or retrieve manip object

    if (Caman.store[arguments[0]]) {      
      
      return Caman.store[arguments[0]];
      
    } else {
          
      // Not initialized; load Caman
      return new Caman.manip.loadImage(arguments[0]);
      
    }
  } else if (arguments.length == 2) {
    // 2 arguments - init image and/or invoke callback
    
    if (Caman.store[arguments[0]]) {
      // Already initialized, invoke callback with manip set to 'this'
      return arguments[1].call(Caman.store[arguments[0]], Caman.store[arguments[0]]);
    } else {
      if (typeof arguments[1] === 'function') {
        
        // Not initialized; load Caman into image then invoke callback and return manip
        return new Caman.manip.loadImage(arguments[0], arguments[1]);
        
      } else if (typeof arguments[1] === 'string') {
        
        // Not initialized; load image URL into canvas and return manip
        return new Caman.manip.loadCanvas(arguments[0], arguments[1]);
        
      }
    }
  } else if (arguments.length == 3) {
    // 3 arguments - init image URL into canvas and invoke callback
    if (Caman.store[arguments[0]]) {
    
      // Already initialized; invoke callback and return manip
      return arguments[2].call(Caman.store[arguments[1]], Caman.store[arguments[1]]);
      
    } else {
      
      // Not initialized; load image into canvas, invoke callback, and return manip
      return new Caman.manip.loadCanvas(arguments[0], arguments[1], arguments[2]);
      
    }
  }
};

if (!('console' in window)) {
  window.console = {
    log: function () {},
    info: function () {},
    error: function () {}
  };
}

Caman.ready = false;
Caman.store = {};
Caman.renderBlocks = 4;

Caman.remoteProxy = "";

/*
 * Here we define the proxies that ship with CamanJS for easy
 * usage.
 */
Caman.useProxy = function (lang) {
  // define cases where file extensions don't match the language name
  var langToExt = {
    ruby: 'rb',
    python: 'py',
    perl: 'pl'
  };
  
  lang = langToExt[lang.toLowerCase()] || lang.toLowerCase();
  
  return "proxies/caman_proxy." + lang;
};

Caman.uniqid = (function () {
  var id = 0;
  
  return {
    get: function () {
      return id++;
    },
    
    reset: function () {
      id = 0;
    }
  };
}());

var remoteCheck = function (src) {
  // Check to see if image is remote or not
  if (Caman.isRemote(src)) {
    if (!Caman.remoteProxy.length) {
      console.info("Attempting to load remote image without a configured proxy, URL: " + src);
      return;
    } else {
      if (Caman.isRemote(Caman.remoteProxy)) {
        console.info("Cannot use a remote proxy for loading remote images due to same-origin policy");
        return;
      }
      
      // We have a remote proxy setup properly, so lets alter the image src
      return Caman.remoteProxy + "?url=" + encodeURIComponent(src);
    }
  }
};

var finishInit = function (image, canvas, callback) {
  var self = this;
  
  // Used for saving pixel layers
  this.pixelStack = [];
  this.layerStack = [];
  
  canvas.width = image.width;
  canvas.height = image.height;
  
  this.canvas = canvas;
  this.context = canvas.getContext("2d");
  this.context.drawImage(image, 0, 0);
  
  this.image_data = this.context.getImageData(0, 0, image.width, image.height);
  this.pixel_data = this.image_data.data;
  
  this.dimensions = {
    width: image.width, 
    height: image.height
  };
  
  this.renderQueue = [];
  
  Caman.store[this.canvas_id] = this;
  
  callback.call(this, this);
  
  return this;
};

Caman.manip = Caman.prototype = {
  loadImage: function (image_id, callback) {
    var domLoaded,
    self = this,
    startFn = function () {
      var canvas = document.createElement('canvas'),
      image = $(image_id),
      proxyURL = remoteCheck(image.src);
      
      if($(image_id) === null || $(image_id).nodeName.toLowerCase() !== 'img') {
        // element doesn't exist or isn't an image
        throw "Given element ID isn't an image: " + image_id;
      }

      canvas.id = image.id;
      image.parentNode.replaceChild(canvas, image);
      
      if (proxyURL) {
        // Image is remote. Reload image via proxy
        image.src = proxyURL;
      }
      
      // Store the canvas ID
      this.canvas_id = image_id;
      
      this.options = {
        canvas: image_id,
        image: image.src
      };
      
      // Ugh... Firefox 4 has some timing issues here
      image.onload = function () {
        finishInit.call(self, image, canvas, callback);
      };
      
      return this;
    };

    // Default callback
    callback = callback || function () {};
    
    // Check to see if we've been passed a DOM node or a string representing
    // the node's ID
    if (typeof image_id === "object" && image_id.nodeName.toLowerCase() == "img") {
      // DOM node
      var element = image_id;
      
      if (image_id.id) {
        image_id = element.id;
      } else {
        image_id = "caman-" + Caman.uniqid.get();
        element.id = image_id;
      }
    }

    // Need to see if DOM is loaded
    domLoaded = ($(image_id) !== null);
    if (domLoaded) {
      startFn.call(this);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        startFn.call(self);
      }, false);
    }
    
    return this;
  },
  
  loadCanvas: function (url, canvas_id, callback) {
    var domLoaded,
    self = this,
    startFn = function () {
      var canvas = $(canvas_id),
      image = document.createElement('img'),
      proxyURL = remoteCheck(url);
      
      if ($(canvas_id) === null || $(canvas_id).nodeName.toLowerCase() !== 'canvas') {
        // element doesn't exist or isn't a canvas
        throw "Given element ID isn't a canvas: " + canvas_id;
      }
      
      if (proxyURL) {
        image.src = proxyURL;
      } else {
        image.src = url;
      }
      
      this.canvas_id = canvas_id;
      
      this.options = {
        canvas: canvas_id,
        image: image.src
      };

      image.onload = function () {
        finishInit.call(self, image, canvas, callback);
      };
    };

    // Default callback
    callback = callback || function () {};
    
    // Check to see if we've been passed a DOM node or a string representing
    // the node's ID
    if (typeof canvas_id === "object" && canvas_id.nodeName.toLowerCase() == "canvas") {
      // DOM node
      var element = canvas_id;
      
      if (canvas_id.id) {
        canvas_id = element.id;
      } else {
        canvas_id = "caman-" + Caman.uniqid.get();
        element.id = canvas_id;
      }
    }
    
    // Need to see if DOM is loaded
    domLoaded = ($(canvas_id) !== null);
    if (domLoaded) {
      startFn.call(this);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        startFn.call(self);
      }, false);
    }
    
    return this;
  },
  
  /*
   * Grabs the canvas data, encodes it to Base64, then
   * sets the browser location to the encoded data so that
   * the user will be prompted to download it.
   */
  save: function (type) {
    if (type) {
      type = type.toLowerCase();
    }
    
    if (!type || (type !== 'png' && type !== 'jpg')) {
      type = 'png';
    }
    
    var data = this.toBase64(type).replace("image/" + type, "image/octet-stream");
    document.location.href = data;
  },
  
  /*
   * Takes the current canvas data, converts it to Base64, then
   * sets it as the source of a new Image object and returns it.
   */
  toImage: function (type) {
    var img, data;
    
    data = this.toBase64(type);
    
    img = document.createElement('img');
    img.src = data;
    
    return img;
  },
  
  /*
   * Grabs the current canvas data and Base64 encodes it.
   */
  toBase64: function (type) {
    if (type) {
      type = type.toLowerCase();
    }
    
    if (!type || (type !== 'png' && type !== 'jpg')) {
      type = 'png';
    }
    
    return this.canvas.toDataURL("image/" + type);
  },
  
  revert: function (ready) {
    this.loadCanvas(this.options.image, this.options.canvas, ready);
  },
  
  render: function (callback) {
    this.processNext(function () {
      this.context.putImageData(this.image_data, 0, 0);
      
      if (typeof callback === 'function') {
        callback.call(this);
      }
    });    
  }
};

Caman.manip.loadImage.prototype = Caman.manip;
Caman.manip.loadCanvas.prototype = Caman.manip;

/*
 * Utility forEach function for iterating over
 * objects/arrays.
 */
Caman.forEach = function( obj, fn, context ) {
  
  if ( !obj || !fn ) {
    return {};
  }
  
  context = context || this;
  // Use native whenever possible
  if ( forEach && obj.forEach === forEach ) {
    return obj.forEach(fn, context);
  } 

  for ( var key in obj ) {
    if ( hasOwn.call(obj, key) ) {
      fn.call(context, obj[key], key, obj);
    } 
  }        

  return obj;
};

/*
 * Used for extending the Caman object, primarily to
 * add new functionality to the base library.
 */
Caman.extend = function( obj ) {
  var dest = obj, src = slice.call(arguments, 1);


  Caman.forEach( src, function( copy ) {
    for ( var prop in copy ) {
      dest[prop] = copy[prop];
    }
  });
  return dest;      
};

Caman.extend( Caman, {
  processKernel: function (adjust, kernel, divisor, bias) {
    var val = {
      r: 0,
      g: 0,
      b: 0
    };
    
    for (var i = 0; i < adjust.length; i++) {
      for (var j = 0; j < adjust[i].length; j++) {
        val.r += (adjust[i][j] * kernel[i][j].r);
        val.g += (adjust[i][j] * kernel[i][j].g);
        val.b += (adjust[i][j] * kernel[i][j].b);
      }
    }
    
    val.r = (val.r / divisor) + bias;
    val.g = (val.g / divisor) + bias;
    val.b = (val.b / divisor) + bias;
    
    if (val.r > 255) {
      val.r = 255;
    } else if (val.r < 0) {
      val.r = 0;
    }

    if (val.g > 255) {
      val.g = 255;
    } else if (val.g < 0) {
      val.g = 0;
    }
    
    if (val.b > 255) {
      val.b = 255;
    } else if (val.b < 0) {
      val.b = 0;
    }
    
    return val;
  }
});

/*
 * CamanJS event system
 * Events can be subscribed to using Caman.listen() and events
 * can be triggered using Caman.trigger().
 */
Caman.events  = {
  types: [ "processStart", "processComplete", "renderFinished" ],
  fn: {
    
    /*
     * Triggers an event with the given target name.
     */
    trigger: function ( target, type, data ) {
      
      var _target = target, _type = type, _data = data;
    
      if ( Caman.events.types.indexOf(target) !== -1 ) {
        _target = this;
        _type = target;
        _data = type;
      }
    
      if ( Caman.events.fn[_type] && Caman.sizeOf(Caman.events.fn[_type]) ) {

        Caman.forEach(Caman.events.fn[_type], function ( obj, key ) {

          obj.call(_target, _data);
        
        });
      }
    },
    
    /*
     * Registers a callback function to be fired when a certain
     * event occurs.
     */
    listen: function ( target, type, fn ) {

      var _target = target, _type = type, _fn = fn;
    
      if ( Caman.events.types.indexOf(target) !== -1 ) {
        _target = this;
        _type = target;
        _fn = type;
      }        

      if ( !Caman.events.fn[_type] ) {
        Caman.events.fn[_type] = [];
      }

      Caman.events.fn[_type].push(_fn);
      
      return true;
    }
  },
  cache: {} /*{
    // [type] = { fn.toString() : fn }
    //  types: processStart, processComplete
  }*/
};

// Basic event system
(function (Caman) {
  
  Caman.forEach( ["trigger", "listen"], function ( key ) {
    Caman[key] = Caman.events.fn[key];
  });  
  
})(Caman);

/*
 * SINGLE = traverse the image 1 pixel at a time
 * KERNEL = traverse the image using convolution kernels
 */
var ProcessType = {
  SINGLE: 1,
  KERNEL: 2,
  LAYER_DEQUEUE: 3,
  LAYER_FINISHED: 4
};

/*
 * Allows the currently rendering filter to get data about
 * surrounding pixels relative to the pixel currently being
 * processed. The data returned is identical in format to the
 * rgba object provided in the process function.
 *
 * Example: to get data about the pixel to the top-right
 * of the currently processing pixel, you can call (within the process
 * function):
 *    this.getPixel(1, -1);
 */
Caman.manip.pixelInfo = function (loc, self) {
  this.loc = loc;
  this.manip = self;
};

Caman.manip.pixelInfo.prototype.locationXY = function () {
  var x, y;
  
  y = this.manip.dimensions.height - Math.floor(this.loc / (this.manip.dimensions.width * 4));
  x = ((this.loc % (this.manip.dimensions.width * 4)) / 4) - 1;
  
  return {x: x, y: y};
};
  
Caman.manip.pixelInfo.prototype.getPixelRelative = function (horiz_offset, vert_offset) {
  // We invert the vert_offset in order to make the coordinate system non-inverted. In laymans
  // terms: -1 means down and +1 means up.
  var newLoc = this.loc + (this.manip.dimensions.width * 4 * (vert_offset * -1)) + (4 * horiz_offset);
  
  // error handling
  if (newLoc > this.manip.pixel_data.length || newLoc < 0) {
    return {r: 0, g: 0, b: 0, a: 0};
  }
  
  return {
    r: this.manip.pixel_data[newLoc],
    g: this.manip.pixel_data[newLoc+1],
    b: this.manip.pixel_data[newLoc+2],
    a: this.manip.pixel_data[newLoc+3]
  };
};
    
Caman.manip.pixelInfo.prototype.putPixelRelative = function (horiz_offset, vert_offset, rgba) {
  var newLoc = this.loc + (this.manip.dimensions.width * 4 * (vert_offset * -1)) + (4 * horiz_offset);
  
  // error handling
  if (newLoc > this.manip.pixel_data.length || newLoc < 0) {
    return false;
  }
  
  this.manip.pixel_data[newLoc]   = rgba.r;
  this.manip.pixel_data[newLoc+1] = rgba.g;
  this.manip.pixel_data[newLoc+2] = rgba.b;
  this.manip.pixel_data[newLoc+3] =  rgba.a;
};
    
Caman.manip.pixelInfo.prototype.getPixel = function (x, y) {
  var newLoc = (y * this.manip.dimensions.width + x) * 4;
  
  return {
    r: this.manip.pixel_data[newLoc],
    g: this.manip.pixel_data[newLoc+1],
    b: this.manip.pixel_data[newLoc+2],
    a: this.manip.pixel_data[newLoc+3]
  };
};
    
Caman.manip.pixelInfo.prototype.putPixel = function (x, y, rgba) {
  var newLoc = (y * this.manip.dimensions.width + x) * 4;
  
  this.manip.pixel_data[newLoc]   = rgba.r;
  this.manip.pixel_data[newLoc+1] = rgba.g;
  this.manip.pixel_data[newLoc+2] = rgba.b;
  this.manip.pixel_data[newLoc+3] = rgba.a;
};

/*
 * The CamanJS layering system
 */
Caman.manip.canvasQueue = [];

Caman.manip.newLayer = function (callback) {
  var layer = new Caman.manip.canvasLayer(this);
  this.canvasQueue.push(layer);
  this.renderQueue.push({type: ProcessType.LAYER_DEQUEUE});
  
  callback.call(layer);

  return this;
};
 
Caman.manip.canvasLayer = function (manip) {  
  // Default options
  this.options = {
    blendingMode: 'normal',
    opacity: 255
  };
  
  // Create a blank and invisible canvas and append it to the document
  this.layerID = Caman.uniqid.get();
  this.canvas = document.createElement('canvas');
  this.canvas.id = 'camanlayer-' + this.layerID;
  this.canvas.width = manip.dimensions.width;
  this.canvas.height = manip.dimensions.height;
  this.canvas.style.display = 'none';
  
  document.body.appendChild(this.canvas);
  
  this.context = this.canvas.getContext("2d");
  this.context.createImageData(this.canvas.width, this.canvas.height);
  this.image_data = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
  this.pixel_data = this.image_data.data;

  this.__defineGetter__("filter", function () {
    return manip;
  });

  return this;
};

Caman.manip.canvasLayer.prototype.newLayer = function (callback) {
  return this.filter.newLayer.call(this.filter, callback);
};

Caman.manip.canvasLayer.prototype.destroy = function () {
  var canvas = document.getElementById(this.canvas.id);
  canvas.parentNode.removeChild(canvas);
};

Caman.manip.canvasLayer.prototype.setBlendingMode = function (mode) {
  this.options.blendingMode = mode;
  return this;
};

Caman.manip.canvasLayer.prototype.opacity = function (opacity) {
  this.options.opacity = (opacity / 100);
  return this;
};

Caman.manip.canvasLayer.prototype.copyParent = function () {
  var parentData = this.filter.pixel_data;
  
  for (var i = 0; i < this.pixel_data.length; i += 4) {
    this.pixel_data[i]    = parentData[i];
    this.pixel_data[i+1]  = parentData[i+1];
    this.pixel_data[i+2]  = parentData[i+2];
    this.pixel_data[i+3]  = parentData[i+3];
  }
  
  return this;
};

Caman.manip.canvasLayer.prototype.fillColor = function () {
  this.filter.fillColor.apply(this.filter, arguments);
};

Caman.manip.canvasLayer.prototype.render = function () {
  this.filter.renderQueue.push({type: ProcessType.LAYER_FINISHED});
};

Caman.manip.canvasLayer.prototype.applyToParent = function () {
  var parentData = this.filter.pixelStack[this.filter.pixelStack.length - 1],
  layerData = this.filter.pixel_data,
  rgbaParent = {},
  rgbaLayer = {};
  
  for (var i = 0; i < layerData.length; i += 4) {
    rgbaParent = {
      r: parentData[i],
      g: parentData[i+1],
      b: parentData[i+2],
      a: parentData[i+3]
    };
    
    rgbaLayer = {
      r: layerData[i],
      g: layerData[i+1],
      b: layerData[i+2],
      a: layerData[i+3]
    };
    
    rgbaParent = this.blenders[this.options.blendingMode](rgbaLayer, rgbaParent);
    
    parentData[i]   = rgbaParent.r - ((rgbaParent.r - rgbaLayer.r) * this.options.opacity);
    parentData[i+1] = rgbaParent.g - ((rgbaParent.g - rgbaLayer.g) * this.options.opacity);
    parentData[i+2] = rgbaParent.b - ((rgbaParent.b - rgbaLayer.b) * this.options.opacity);
    parentData[i+3] = 255;
  }
};

// Blending functions
Caman.manip.canvasLayer.prototype.blenders = {
  normal: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = rgbaLayer.r;
    rgbaParent.g = rgbaLayer.g;
    rgbaParent.b = rgbaLayer.b;
    
    return rgbaParent;
  },
  
  multiply: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = (rgbaLayer.r * rgbaParent.r) / 255;
    rgbaParent.g = (rgbaLayer.g * rgbaParent.g) / 255;
    rgbaParent.b = (rgbaLayer.b * rgbaParent.b) / 255;
    
    return rgbaParent;
  },
  
  screen: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = 255 - (((255 - rgbaLayer.r) * (255 - rgbaParent.r)) / 255);
    rgbaParent.g = 255 - (((255 - rgbaLayer.g) * (255 - rgbaParent.g)) / 255);
    rgbaParent.b = 255 - (((255 - rgbaLayer.b) * (255 - rgbaParent.b)) / 255);
    
    return rgbaParent;
  },
  
  overlay: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = 
      (rgbaParent.r > 128) ? 
        255 - 2 * (255 - rgbaLayer.r) * (255 - rgbaParent.r) / 255: 
        (rgbaParent.r * rgbaLayer.r * 2) / 255;
        
    rgbaParent.g = 
      (rgbaParent.g > 128) ? 
        255 - 2 * (255 - rgbaLayer.g) * (255 - rgbaParent.g) / 255: 
        (rgbaParent.g * rgbaLayer.g * 2) / 255;
        
    rgbaParent.b = 
      (rgbaParent.b > 128) ? 
        255 - 2 * (255 - rgbaLayer.b) * (255 - rgbaParent.b) / 255: 
        (rgbaParent.b * rgbaLayer.b * 2) / 255;
    
    return rgbaParent;
  },
  
  difference: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = rgbaLayer.r - rgbaParent.r;
    rgbaParent.g = rgbaLayer.g - rgbaParent.g;
    rgbaParent.b = rgbaLayer.b - rgbaParent.b;
    
    return rgbaParent;
  },
  
  addition: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = rgbaParent.r + rgbaLayer.r;
    rgbaParent.g = rgbaParent.g + rgbaLayer.g;
    rgbaParent.b = rgbaParent.b + rgbaLayer.b;
    
    return rgbaParent;
  },
  
  exclusion: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = 128 - 2 * (rgbaParent.r - 128) * (rgbaLayer.r - 128) / 255;
    rgbaParent.g = 128 - 2 * (rgbaParent.g - 128) * (rgbaLayer.g - 128) / 255;
    rgbaParent.b = 128 - 2 * (rgbaParent.b - 128) * (rgbaLayer.b - 128) / 255;
    
    return rgbaParent;
  },
  
  softLight: function (rgbaLayer, rgbaParent) {
    rgbaParent.r = 
      (rgbaParent.r > 128) ? 
        255 - ((255 - rgbaParent.r) * (255 - (rgbaLayer.r - 128))) / 255 : 
        (rgbaParent.r * (rgbaLayer.r + 128)) / 255;
      
    rgbaParent.g = 
      (rgbaParent.g > 128) ? 
        255 - ((255 - rgbaParent.g) * (255 - (rgbaLayer.g - 128))) / 255 : 
        (rgbaParent.g * (rgbaLayer.g + 128)) / 255;
    
    rgbaParent.b = (rgbaParent.b > 128) ? 
      255 - ((255 - rgbaParent.b) * (255 - (rgbaLayer.b - 128))) / 255 : 
      (rgbaParent.b * (rgbaLayer.b + 128)) / 255;
      
    return rgbaParent;
  }
};

Caman.manip.blenders = Caman.manip.canvasLayer.prototype.blenders;

/*
 * The core of the image rendering, this function executes
 * the provided filter and updates the canvas pixel data
 * accordingly. NOTE: this does not write the updated pixel
 * data to the canvas. That happens when all filters are finished
 * rendering in order to be as fast as possible.
 */
Caman.manip.executeFilter = function (adjust, processFn, type) {
  var n = this.pixel_data.length,
  res = null,
  
  // (n/4) == # of pixels in image
  // Give remaining pixels to last block in case it doesn't
  // divide evenly.
  blockPixelLength = Math.floor((n / 4) / Caman.renderBlocks),
  
  // expand it again to make the loop easier.
  blockN = blockPixelLength * 4,
  
  // add the remainder pixels to the last block.
  lastBlockN = blockN + ((n / 4) % Caman.renderBlocks) * 4,

  self = this,
  
  blocks_done = 0,
  
  // Called whenever a block finishes. It's used to determine when all blocks
  // finish rendering.
  block_finished = function (bnum) {
    if (bnum >= 0) {
      console.log("Block #" + bnum + " finished! Filter: " + processFn.name);
    }
    
    blocks_done++;

    if (blocks_done == Caman.renderBlocks || bnum == -1) {
      if (bnum >= 0) {
        console.log("Filter " + processFn.name + " finished!");
      } else {
        console.log("Kernel filter finished!");
      }
      
      Caman.trigger("processComplete", {id: self.canvas_id, completed: processFn.name});
      
      self.processNext();
    }
  },
  
  /*
   * Renders a block of the image bounded by the start and end
   * parameters.
   */
  render_block = function (bnum, start, end) {
    console.log("BLOCK #" + bnum + " - Filter: " + processFn.name + ", Start: " + start + ", End: " + end);
    
    setTimeout(function () {
      for (var i = start; i < end; i += 4) {
        res = processFn.call(new self.pixelInfo(i, self), adjust, {
          r: self.pixel_data[i], 
          g: self.pixel_data[i+1], 
          b: self.pixel_data[i+2], 
          a: self.pixel_data[i+3]
        });
        
        self.pixel_data[i]   = res.r;
        self.pixel_data[i+1] = res.g;
        self.pixel_data[i+2] = res.b;
        self.pixel_data[i+3] = res.a;
      }
      
      block_finished(bnum);
    }, 0);
  },
  
  render_kernel = function () {
    setTimeout(function () {
      var kernel, pixelInfo, 
      start, end, 
      mod_pixel_data = [],
      name = adjust.name,
      bias = adjust.bias,
      divisor = adjust.divisor;
      
      adjust = adjust.adjust;
      
      console.log("Rendering kernel - Filter: " + name);
      
      if (adjust.length === 3) {
        kernel = [[],[],[]];
        start = self.dimensions.width * 4;
        end = n - (self.dimensions.width * 4);
      } else {
        kernel = [[],[],[],[],[]];
        start = self.dimensions.width * 8;
        end = n - (self.dimensions.width * 8);
      }
      
      for (var i = start; i < end; i += 4) {
        pixelInfo = new self.pixelInfo(i, self);
        
        // kernel is a 3x3 or 5x5 2D array expressed as [x][y]
        if (adjust.length == 3) {
          kernel[0][0] = pixelInfo.getPixelRelative(-1, 1);  // top left
          kernel[1][0] = pixelInfo.getPixelRelative(0, 1);   // top middle
          kernel[2][0] = pixelInfo.getPixelRelative(1, 1);   // top right
          
          kernel[0][1] = pixelInfo.getPixelRelative(-1, 0);  // middle left
          kernel[1][1] = pixelInfo.getPixelRelative(0, 0);   // middle middle (kernel)
          kernel[2][1] = pixelInfo.getPixelRelative(1, 0);   // middle right
          
          kernel[0][2] = pixelInfo.getPixelRelative(-1, -1); // bottom left
          kernel[1][2] = pixelInfo.getPixelRelative(0, -1);  // bottom middle
          kernel[2][2] = pixelInfo.getPixelRelative(1, -1);  // bottom right
        } else {
          kernel[0][0] = pixelInfo.getPixelRelative(-2, 2);
          kernel[1][0] = pixelInfo.getPixelRelative(-1, 2);
          kernel[2][0] = pixelInfo.getPixelRelative(0, 2);
          kernel[3][0] = pixelInfo.getPixelRelative(1, 2);
          kernel[4][0] = pixelInfo.getPixelRelative(2, 2);
          
          kernel[0][1] = pixelInfo.getPixelRelative(-2, 1);
          kernel[1][1] = pixelInfo.getPixelRelative(-1, 1);
          kernel[2][1] = pixelInfo.getPixelRelative(0, 1);
          kernel[3][1] = pixelInfo.getPixelRelative(1, 1);
          kernel[4][1] = pixelInfo.getPixelRelative(2, 1);
          
          kernel[0][2] = pixelInfo.getPixelRelative(-2, 0);
          kernel[1][2] = pixelInfo.getPixelRelative(-1, 0);
          kernel[2][2] = pixelInfo.getPixelRelative(0, 0); // kernel
          kernel[3][2] = pixelInfo.getPixelRelative(1, 0);
          kernel[4][2] = pixelInfo.getPixelRelative(2, 0);
          
          kernel[0][3] = pixelInfo.getPixelRelative(-2, -1);
          kernel[1][3] = pixelInfo.getPixelRelative(-1, -1);
          kernel[2][3] = pixelInfo.getPixelRelative(0, -1);
          kernel[3][3] = pixelInfo.getPixelRelative(1, -1);
          kernel[4][3] = pixelInfo.getPixelRelative(2, -1);
          
          kernel[0][4] = pixelInfo.getPixelRelative(-2, -2);
          kernel[1][4] = pixelInfo.getPixelRelative(-1, -2);
          kernel[2][4] = pixelInfo.getPixelRelative(0, -2);
          kernel[3][4] = pixelInfo.getPixelRelative(1, -2);
          kernel[4][4] = pixelInfo.getPixelRelative(2, -2);
        }
        
        // Execute the kernel processing function
        res = processFn.call(pixelInfo, adjust, kernel, divisor, bias);

        // Update the new pixel array since we can't modify the original
        // until the convolutions are finished on the entire image.
        mod_pixel_data[i]   = res.r;
        mod_pixel_data[i+1] = res.g;
        mod_pixel_data[i+2] = res.b;
        mod_pixel_data[i+3] = 255;
      }

      // Update the actual canvas pixel data
      for (i = start; i < end; i++) {
        self.pixel_data[i] = mod_pixel_data[i];
      }
      
      block_finished(-1);
      
    }, 0);
  };
  
  if (type === ProcessType.SINGLE) {
    // Split the image into its blocks.
    for (var j = 0; j < Caman.renderBlocks; j++) {
     var start = j * blockN,
     end = start + ((j == Caman.renderBlocks - 1) ? lastBlockN : blockN);
     render_block(j, start, end);
    }
  } else {
    render_kernel();
  }
};

Caman.manip.executeLayer = function (layer) {
  this.pushContext(layer);
  this.processNext();
};

Caman.manip.pushContext = function (layer) {
  console.log("PUSH LAYER!");
  
  this.currentLayer = layer;
  this.pixelStack.push(this.pixel_data);
  this.layerStack.push(layer);
  
  this.pixel_data = layer.pixel_data;
};

Caman.manip.popContext = function () {
  console.log("POP LAYER!");
  
  this.pixel_data = this.pixelStack.pop();
  this.layerStack.pop().destroy();
  this.currentLayer = this.layerStack[this.layerStack.length -1];
};

Caman.manip.applyCurrentLayer = function () {
  this.currentLayer.applyToParent();
};

Caman.manip.process = function (adjust, processFn) {
  // Since the block-based renderer is asynchronous, we simply build
  // up a render queue and execute the filters in order once
  // render() is called instead of executing them as they're called
  // synchronously.
  this.renderQueue.push({adjust: adjust, processFn: processFn, type: ProcessType.SINGLE});
  
  return this;
};

Caman.manip.processKernel = function (name, adjust, divisor, bias) {  
  if (!divisor) {
    divisor = 0;
    for (var i = 0; i < adjust.length; i++) {
      for (var j = 0; j < adjust[i].length; j++) {
        divisor += adjust[i][j];
      }
    }
  }
  
  var data = {
    name: name,
    adjust: adjust,
    divisor: divisor,
    bias: bias || 0
  };
  
  this.renderQueue.push({adjust: data, processFn: Caman.processKernel, type: ProcessType.KERNEL});
  
  return this;
};

/*
 * Begins the render process if it's not started, or moves to the next
 * filter in the queue and processes it. Calls the finishedFn callback
 * when the render queue is empty.
 */
Caman.manip.processNext = function (finishedFn) {
  if (typeof finishedFn === "function") {
    this.finishedFn = finishedFn;
  }
  
  if (this.renderQueue.length === 0) {
    Caman.trigger("renderFinished", {id: this.canvas_id});
    
    if (typeof this.finishedFn === "function") {
      this.finishedFn.call(this);
    }
    
    return;
  }
  
  var next = this.renderQueue.shift();
  
  if (next.type == ProcessType.LAYER_DEQUEUE) {
    var layer = this.canvasQueue.shift();
    this.executeLayer(layer);
  } else if (next.type == ProcessType.LAYER_FINISHED) {
    this.applyCurrentLayer();
    this.popContext();
    this.processNext();
  } else {
    this.executeFilter(next.adjust, next.processFn, next.type);
  }
};

// Expose Caman to the world!
window.Caman = Caman;

}());
/*!
 * These are all of the utility functions used in CamanJS
 */
 
(function (Caman) {

Caman.extend(Caman, {
  /*
   * Returns the size of an object (the number of properties
   * the object has)
   */
  sizeOf: function ( obj ) {
    var size = 0,
        prop;
    
    for ( prop in obj  ) {
      size++;
    }
            
    return size;
  },
  
  /*
   * Determines whether two given objects are the same based
   * on their properties and values.
   */
  sameAs: function ( base, test ) {
    
    // only tests arrays
    // TODO: extend to object tests
    if ( base.length !== test.length ) {
      return false;
    }
    
    for ( var i = base.length; i >= 0; i-- )  {
      if ( base[i] !== test[i] ) {
        return false;
      }
    }
    return true;
  },
  
  isRemote: function (url) {
    var domain_regex = /(?:(?:http|https):\/\/)((?:\w+)\.(?:(?:\w|\.)+))/,
    test_domain;
    
    if (!url || !url.length) {
      return;
    }
    
    var matches = url.match(domain_regex);
    if (matches) {
      test_domain = matches[1];

      return test_domain != document.domain;
    } else {
      return false;
    }
  },
  
  /*
   * Removes items with the given value from an array if they
   * are present.
   */
  remove: function ( arr, item ) {
    var ret = [];
    
    for ( var i = 0, len = arr.length; i < len; i++ ) {
      if ( arr[i] !== item  ) {
        ret.push(arr[i]);
      }
    }
    
    arr = ret;
    
    return ret;      
  },
    
  randomRange: function (min, max, float) {
    var rand = min + (Math.random() * (max - min));
    return typeof float == 'undefined' ? Math.round(rand) : rand.toFixed(float);
  },
  
  /**
   * Converts an RGB color to HSL.
   * Assumes r, g, and b are in the set [0, 255] and
   * returns h, s, and l in the set [0, 1].
   *
   * @param   Number  r   Red channel
   * @param   Number  g   Green channel
   * @param   Number  b   Blue channel
   * @return              The HSL representation
   */
  rgb_to_hsl: function(r, g, b) {
  
    r /= 255;
    g /= 255;
    b /= 255;
    
    var max = Math.max(r, g, b), min = Math.min(r, g, b), 
        h, s, l = (max + min) / 2;
    
    if(max == min){
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return {h: h, s: s, l: l};
  },
  
  hue_to_rgb: function (p, q, t) {
    if(t < 0) t += 1;
    if(t > 1) t -= 1;
    if(t < 1/6) return p + (q - p) * 6 * t;
    if(t < 1/2) return q;
    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  },
  
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h, s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   Number  h       The hue
   * @param   Number  s       The saturation
   * @param   Number  l       The lightness
   * @return  Array           The RGB representation
   */
  hsl_to_rgb: function(h, s, l){
      var r, g, b;
  
      if(s === 0){
          r = g = b = l; // achromatic
      } else {
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = this.hue_to_rgb(p, q, h + 1/3);
          g = this.hue_to_rgb(p, q, h);
          b = this.hue_to_rgb(p, q, h - 1/3);
      }
      
      return {r: r * 255, g: g * 255, b: b * 255};
  },
  
  /**
   * Converts an RGB color value to HSV. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h, s, and v in the set [0, 1].
   *
   * @param   Number  r       The red color value
   * @param   Number  g       The green color value
   * @param   Number  b       The blue color value
   * @return  Array           The HSV representation
   */
  rgb_to_hsv: function(r, g, b){
      
      r = r/255;
      g = g/255;
      b = b/255;
      
      var max = Math.max(r, g, b), min = Math.min(r, g, b),
          h, s, v = max,
          d = max - min;
          
      s = max === 0 ? 0 : d / max;
  
      if(max == min){
          h = 0; // achromatic
      } else {
          switch(max){
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
      }
  
      return {h: h, s: s, v: v};
  },
  
  /**
   * Converts an HSV color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
   * Assumes h, s, and v are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   Number  h       The hue
   * @param   Number  s       The saturation
   * @param   Number  v       The value
   * @return  Array           The RGB representation
   */
  hsv_to_rgb: function(h, s, v){
    
      var r, g, b,
          i = Math.floor(h * 6),
          f = h * 6 - i,
          p = v * (1 - s),
          q = v * (1 - f * s),
          t = v * (1 - (1 - f) * s);
  
      switch(i % 6){
          case 0: 
            r = v;
            g = t;
            b = p;
            break;
          case 1:
            r = q;
            g = v;
            b = p;
            break;
          case 2:
            r = p;
            g = v;
            b = t;
            break;
          case 3:
            r = p;
            g = q;
            b = v;
            break;
          case 4:
            r = t;
            g = p;
            b = v;
            break;
          case 5:
            r = v;
            g = p;
            b = q;
            break;
      }
  
      return {r: r * 255, g: g * 255, b: b * 255};
  },
  
  /**
   * Converts a RGB color value to the XYZ color space. Formulas
   * are based on http://en.wikipedia.org/wiki/SRGB assuming that
   * RGB values are sRGB.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns x, y, and z.
   *
   * @param   Number  r       The red color value
   * @param   Number  g       The green color value
   * @param   Number  b       The blue color value
   * @return  Array           The XYZ representation
   */
  rgb_to_xyz: function (r, g, b) {
  
    r = r / 255; g = g / 255; b = b / 255;
  
    if (r > 0.04045) {
      r = Math.pow((r + 0.055) / 1.055, 2.4);
    } else {
      r = r / 12.92;
    }
  
    if (g > 0.04045) {
      g = Math.pow((g + 0.055) / 1.055, 2.4);
    } else {
      g = g / 12.92;
    }
  
    if (b > 0.04045) {
      b = Math.pow((b + 0.055) / 1.055, 2.4);
    } else {
      b = b / 12.92;
    }
  
    var x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    var y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    var z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  
    return {x: x * 100, y: y * 100, z: z * 100};
  },
  
  /**
   * Converts a XYZ color value to the sRGB color space. Formulas
   * are based on http://en.wikipedia.org/wiki/SRGB and the resulting
   * RGB value will be in the sRGB color space.
   * Assumes x, y and z values are whatever they are and returns
   * r, g and b in the set [0, 255].
   *
   * @param   Number  x       The X value
   * @param   Number  y       The Y value
   * @param   Number  z       The Z value
   * @return  Array           The RGB representation
   */
  xyz_to_rgb: function (x, y, z) {

    x = x / 100; y = y / 100; z = z / 100;
  
    var r, g, b;
    r = (3.2406  * x) + (-1.5372 * y) + (-0.4986 * z);
    g = (-0.9689 * x) + (1.8758  * y) + (0.0415  * z);
    b = (0.0557  * x) + (-0.2040 * y) + (1.0570  * z);
  
    if(r > 0.0031308) {
      r = (1.055 * Math.pow(r, 0.4166666667)) - 0.055;
    } else {
      r = 12.92 * r;
    }
  
    if(g > 0.0031308) {
      g = (1.055 * Math.pow(g, 0.4166666667)) - 0.055;
    } else {
      g = 12.92 * g;
    }
  
    if(b > 0.0031308) {
      b = (1.055 * Math.pow(b, 0.4166666667)) - 0.055;
    } else {
      b = 12.92 * b;
    }
  
    return {r: r * 255, g: g * 255, b: b * 255};
  },
  
  /**
   * Converts a XYZ color value to the CIELAB color space. Formulas
   * are based on http://en.wikipedia.org/wiki/Lab_color_space
   * The reference white point used in the conversion is D65.
   * Assumes x, y and z values are whatever they are and returns
   * L*, a* and b* values
   *
   * @param   Number  x       The X value
   * @param   Number  y       The Y value
   * @param   Number  z       The Z value
   * @return  Array           The Lab representation
   */
  xyz_to_lab: function(x, y, z) {
  
    // D65 reference white point
    var whiteX = 95.047, whiteY = 100.0, whiteZ = 108.883;
  
    x = x / whiteX; y = y / whiteY; z = z / whiteZ;
  
    if (x > 0.008856451679) { // (6/29) ^ 3
      x = Math.pow(x, 0.3333333333);
    } else {
      x = (7.787037037 * x) + 0.1379310345; // (1/3) * ((29/6) ^ 2)c + (4/29)
    }
  
    if (y > 0.008856451679) {
      y = Math.pow(y, 0.3333333333);
    } else {
      y = (7.787037037 * y) + 0.1379310345;
    }
  
    if (z > 0.008856451679) {
      z = Math.pow(z, 0.3333333333);
    } else {
      z = (7.787037037 * z) + 0.1379310345;
    }
  
    var l = 116 * y - 16;
    var a = 500 * (x - y);
    var b = 200 * (y - z);
  
    return {l: l, a: a, b: b};
  },
  
  /**
   * Converts a L*, a*, b* color values from the CIELAB color space
   * to the XYZ color space. Formulas are based on
   * http://en.wikipedia.org/wiki/Lab_color_space
   * The reference white point used in the conversion is D65.
   * Assumes L*, a* and b* values are whatever they are and returns
   * x, y and z values.
   *
   * @param   Number  l       The L* value
   * @param   Number  a       The a* value
   * @param   Number  b       The b* value
   * @return  Array           The XYZ representation
   */
  lab_to_xyz: function(l, a, b) {
  
    var y = (l + 16) / 116;
    var x = y + (a / 500);
    var z = y - (b / 200);
  
    if (x > 0.2068965517) { // 6 / 29
      x = x * x * x;
    } else {
      x = 0.1284185493 * (x - 0.1379310345); // 3 * ((6 / 29) ^ 2) * (c - (4 / 29))
    }
  
    if (y > 0.2068965517) {
      y = y * y * y;
    } else {
      y = 0.1284185493 * (y - 0.1379310345);
    }
  
    if (z > 0.2068965517) {
      z = z * z * z;
    } else {
      z = 0.1284185493 * (z - 0.1379310345);
    }
  
    // D65 reference white point
    return {x: x * 95.047, y: y * 100.0, z: z * 108.883};
  },
  
  /*
   * Converts the hex representation of a color to RGB values.
   * Hex value can optionally start with the hash (#).
   *
   * @param   String  hex   The colors hex value
   * @return  Array         The RGB representation
   */
  hex_to_rgb: function(hex) {
    var r, g, b;
    
    if (hex.charAt(0) === "#") {
      hex = hex.substr(1);
    }
    
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
    
    return {r: r, g: g, b: b};
  },
  
  bezier: function (start, ctrl1, ctrl2, end, lowBound, highBound) {
    var Ax, Bx, Cx, Ay, By, Cy,
    x0 = start[0], y0 = start[1],
    x1 = ctrl1[0], y1 = ctrl1[1],
    x2 = ctrl2[0], y2 = ctrl2[1],
    x3 = end[0], y3 = end[1],
    t, curveX, curveY,
    bezier = {};
    
    // Calculate our X and Y coefficients
    Cx = 3 * (x1 - x0);
    Bx = 3 * (x2 - x1) - Cx;
    Ax = x3 - x0 - Cx - Bx;
    
    Cy = 3 * (y1 - y0);
    By = 3 * (y2 - y1) - Cy;
    Ay = y3 - y0 - Cy - By;
    
    for (var i = 0; i < 1000; i++) {
      t = i / 1000;
      
      curveX = Math.round((Ax * Math.pow(t, 3)) + (Bx * Math.pow(t, 2)) + (Cx * t) + x0);
      curveY = Math.round((Ay * Math.pow(t, 3)) + (By * Math.pow(t, 2)) + (Cy * t) + y0);
      
      if (lowBound && curveY < lowBound) {
        curveY = lowBound;
      } else if (highBound && curveY > highBound) {
        curveY = highBound;
      }
      
      bezier[curveX] = curveY;
    }
    
    // Do a search for missing values in the bezier array and use linear interpolation
    // to approximate their values.
    var leftCoord, rightCoord, j, slope, bint;
    if (bezier.length < end[0] + 1) {
      for (i = 0; i <= end[0]; i++) {
        if (typeof bezier[i] === "undefined") {
          // The value to the left will always be defined. We don't have to worry about
          // when i = 0 because the starting point is guaranteed (I think...)
          leftCoord = [i-1, bezier[i-1]];
          
          // Find the first value to the right that was found. Ideally this loop will break
          // very quickly.
          for (j = i; j <= end[0]; j++) {
            if (typeof bezier[j] !== "undefined") {
              rightCoord = [j, bezier[j]];
              break;
            }
          }
          
          bezier[i] = leftCoord[1] + ((rightCoord[1] - leftCoord[1]) / (rightCoord[0] - leftCoord[0])) * (i - leftCoord[0]);
        }
      }
    }
    
    // Edge case
    if (typeof bezier[end[0]] === "undefined") {
      bezier[end[0]] = bezier[254];
    }
    
    return bezier;
  }
});

}(Caman));
/*!
 * Below are all of the built-in filters that are a part
 * of the CamanJS core library.
 */
 
(function(Caman) {
  Caman.manip.fillColor = function () {
    var color;
    if (arguments.length == 1) {
      color = Caman.hex_to_rgb(arguments[0]);
    } else {
      color = {
        r: arguments[0],
        g: arguments[1],
        b: arguments[2]
      };
    }
    
    return this.process( color, function fillColor(color, rgba) {
      rgba.r = color.r;
      rgba.g = color.g;
      rgba.b = color.b;
      
      return rgba;
    });
  };

  Caman.manip.brightness = function(adjust) {
    
    adjust = Math.floor(255 * (adjust / 100));
    
    return this.process( adjust,  function brightness(adjust, rgba) {
      rgba.r += adjust;
      rgba.g += adjust;
      rgba.b += adjust;
      
      return rgba;
    });
  };

  Caman.manip.saturation = function(adjust) {
    var max, diff;
    adjust *= -1;
    
    return this.process( adjust, function saturation(adjust, rgba) {
      var chan;
      
      max = Math.max(rgba.r, rgba.g, rgba.b);
      
      for (chan in rgba) {
        if (rgba.hasOwnProperty(chan)) {
          if (rgba[chan] === max || chan === "a") {
            continue;
          }
            
          diff = max - rgba[chan];
          rgba[chan] += Math.ceil(diff * (adjust / 100));
        }
      }
      
      return rgba;
    });
  };
  
  Caman.manip.vibrance = function (adjust) {
    var max, avg, amt, diff;
    adjust *= -1;
    
    return this.process( adjust, function vibrance(adjust, rgba) {
      var chan;
      
      max = Math.max(rgba.r, rgba.g, rgba.b);
      
      // Calculate difference between max color and other colors
      avg = (rgba.r + rgba.g + rgba.b) / 3;
      amt = ((Math.abs(max - avg) * 2 / 255) * adjust) / 100;
      
      for (chan in rgba) {
        if (rgba.hasOwnProperty(chan)) {
          if (rgba[chan] === max || chan == "a") {
            continue;
          }
          
          diff = max - rgba[chan];
          rgba[chan] += Math.ceil(diff * amt);
        }
      }
      
      return rgba;
    });
  };
  
  /*
   * An improved greyscale function that should make prettier results
   * than simply using the saturation filter to remove color. There are
   * no arguments, it simply makes the image greyscale with no in-between.
   *
   * Algorithm adopted from http://www.phpied.com/image-fun/
   */
  Caman.manip.greyscale = function () {
    return this.process({}, function greyscale(adjust, rgba) {
      var avg = 0.3 * rgba.r + 0.59 * rgba.g + 0.11 * rgba.b;
      
      rgba.r = avg;
      rgba.g = avg;
      rgba.b = avg;
      
      return rgba;
    });
  };
  
  Caman.manip.contrast = function(adjust) {
    adjust = (adjust + 100) / 100;
    adjust = Math.pow(adjust, 2);

    return this.process( adjust, function contrast(adjust, rgba) {
      /* Red channel */
      rgba.r /= 255;
      rgba.r -= 0.5;
      rgba.r *= adjust;
      rgba.r += 0.5;
      rgba.r *= 255;
      
      /* Green channel */
      rgba.g /= 255;
      rgba.g -= 0.5;
      rgba.g *= adjust;
      rgba.g += 0.5;
      rgba.g *= 255;
      
      /* Blue channel */
      rgba.b /= 255;
      rgba.b -= 0.5;
      rgba.b *= adjust;
      rgba.b += 0.5;
      rgba.b *= 255;
      
      // While uglier, I found that using if statements are
      // faster than calling Math.max() and Math.min() to bound
      // the numbers.
      if (rgba.r > 255) {
        rgba.r = 255;
      } else if (rgba.r < 0) {
        rgba.r = 0;
      }
      
      if (rgba.g > 255) {
        rgba.g = 255;
      } else if (rgba.g < 0) {
        rgba.g = 0;
      }
      
      if (rgba.b > 255) {
        rgba.b = 255;
      } else if (rgba.b < 0) {
        rgba.b = 0;
      }
              
      return rgba;
    });
  };
  
  Caman.manip.hue = function(adjust) {
    var hsv, h;

    return this.process( adjust, function hue(adjust, rgba) {
      var rgb;
      
      hsv = Caman.rgb_to_hsv(rgba.r, rgba.g, rgba.b);
      h = hsv.h * 100;
      h += Math.abs(adjust);
      h = h % 100;
      h /= 100;
      hsv.h = h;
      
      rgb = Caman.hsv_to_rgb(hsv.h, hsv.s, hsv.v);
      
      return {r: rgb.r, g: rgb.g, b: rgb.b, a: rgba.a};
    });
  };
  
  Caman.manip.colorize = function() {
    var diff, rgb, level;
            
    if (arguments.length === 2) {
      rgb = Caman.hex_to_rgb(arguments[0]);
      level = arguments[1];
    } else if (arguments.length === 4) {
      rgb = {
        r: arguments[0],
        g: arguments[1],
        b: arguments[2]        
      };
      
      level = arguments[3];
    }
    
    return this.process( [ level, rgb ],  function colorize( adjust, rgba) {
        // adjust[0] == level; adjust[1] == rgb;
        rgba.r -= (rgba.r - adjust[1].r) * (adjust[0] / 100);
        rgba.g -= (rgba.g - adjust[1].g) * (adjust[0] / 100);
        rgba.b -= (rgba.b - adjust[1].b) * (adjust[0] / 100);
        
        return rgba;
    });
  };
  
  Caman.manip.invert = function () {
    return this.process({}, function invert (adjust, rgba) {
      rgba.r = 255 - rgba.r;
      rgba.g = 255 - rgba.g;
      rgba.b = 255 - rgba.b;
      
      return rgba;
    });
  };
  
  /*
   * Applies a sepia filter to the image. Assumes adjustment is between 0 and 100,
   * which represents how much the sepia filter is applied.
   */
  Caman.manip.sepia = function (adjust) {
    if (adjust === undefined) {
      adjust = 100;
    }
    
    adjust = (adjust / 100);
    
    return this.process(adjust, function sepia (adjust, rgba) {
      rgba.r = Math.min(255, (rgba.r * (1 - (0.607 * adjust))) + (rgba.g * (0.769 * adjust)) + (rgba.b * (0.189 * adjust)));
      rgba.g = Math.min(255, (rgba.r * (0.349 * adjust)) + (rgba.g * (1 - (0.314 * adjust))) + (rgba.b * (0.168 * adjust)));
      rgba.b = Math.min(255, (rgba.r * (0.272 * adjust)) + (rgba.g * (0.534 * adjust)) + (rgba.b * (1- (0.869 * adjust))));
      
      return rgba;
    });
  };
  
  /*
   * Adjusts the gamma of the image. I would stick with low values to be safe.
   */
  Caman.manip.gamma = function (adjust) {
    return this.process(adjust, function gamma(adjust, rgba) {
      rgba.r = Math.pow(rgba.r / 255, adjust) * 255;
      rgba.g = Math.pow(rgba.g / 255, adjust) * 255;
      rgba.b = Math.pow(rgba.b / 255, adjust) * 255;
      
      return rgba;
    });
  };
  
  /*
   * Adds noise to the image on a scale from 1 - 100
   * However, the scale isn't constrained, so you can specify
   * a value > 100 if you want a LOT of noise.
   */
  Caman.manip.noise = function (adjust) {
    adjust = Math.abs(adjust) * 2.55;
    return this.process(adjust, function noise(adjust, rgba) {
      var rand = Caman.randomRange(adjust*-1, adjust);
      rgba.r += rand;
      rgba.g += rand;
      rgba.b += rand;
      
      return rgba;
    });
  };
  
  /*
   * Clips a color to max values when it falls outside of the specified range.
   * User supplied value should be between 0 and 100.
   */
  Caman.manip.clip = function (adjust) {
    adjust = Math.abs(adjust) * 2.55;
    return this.process(adjust, function clip(adjust, rgba) {
      if (rgba.r > 255 - adjust) {
        rgba.r = 255;
      } else if (rgba.r < adjust) {
        rgba.r = 0;
      }
      
      if (rgba.g > 255 - adjust) {
        rgba.g = 255;
      } else if (rgba.g < adjust) {
        rgba.g = 0;
      }
      
      if (rgba.b > 255 - adjust) {
        rgba.b = 255;
      } else if (rgba.b < adjust) {
        rgba.b = 0;
      }
      
      return rgba;
    });
  };
  
  /*
   * Lets you modify the intensity of any combination of red, green, or blue channels.
   * Options format (must specify 1 - 3 colors):
   * {
   *  red: 20,
   *  green: -5,
   *  blue: -40
   * }
   */
  Caman.manip.channels = function (options) {
    if (typeof(options) !== 'object') {
      return;
    }
    
    for (var chan in options) {
      if (options.hasOwnProperty(chan)) {
        if (options[chan] === 0) {
          delete options[chan];
          continue;
        }
        
        options[chan] = options[chan] / 100;
      }
    }
    
    if (options.length === 0) {
      return;
    }
    
    return this.process(options, function channels(options, rgba) {
      if (options.red) {
        if (options.red > 0) {
          // fraction of the distance between current color and 255
          rgba.r = rgba.r + ((255 - rgba.r) * options.red);
        } else {
          rgba.r = rgba.r - (rgba.r * Math.abs(options.red));
        }
      }
      
      if (options.green) {
        if (options.green > 0) {
          rgba.g = rgba.g + ((255 - rgba.g) * options.green);
        } else {
          rgba.g = rgba.g - (rgba.g * Math.abs(options.green));
        }
      }
      
      if (options.blue) {
        if (options.blue > 0) {
          rgba.b = rgba.b + ((255 - rgba.b) * options.blue);
        } else {
          rgba.b = rgba.b - (rgba.b * Math.abs(options.blue));
        }
      }
      
      return rgba;
    });
  };
  
  /*
   * Curves implementation using Bezier curve equation.
   *
   * Params:
   *    chan - [r, g, b, rgb]
   *    start - [x, y] (start of curve; 0 - 255)
   *    ctrl1 - [x, y] (control point 1; 0 - 255)
   *    ctrl2 - [x, y] (control point 2; 0 - 255)
   *    end   - [x, y] (end of curve; 0 - 255)
   */
  Caman.manip.curves = function (chan, start, ctrl1, ctrl2, end) {
    var bezier, i;
    
    if (typeof chan === 'string') {
      if (chan == 'rgb') {
        chan = ['r', 'g', 'b'];
      } else {
        chan = [chan];
      }
    }
    
    bezier = Caman.bezier(start, ctrl1, ctrl2, end, 0, 255);
    
    // If our curve starts after x = 0, initialize it with a flat line until
    // the curve begins.
    if (start[0] > 0) {
      for (i = 0; i < start[0]; i++) {
        bezier[i] = start[1];
      }
    }
    
    // ... and the same with the end point
    if (end[0] < 255) {
      for (i = end[0]; i <= 255; i++) {
        bezier[i] = end[1];
      }
    }
    
    return this.process({bezier: bezier, chans: chan}, function curves(opts, rgba) {
      for (var i = 0; i < opts.chans.length; i++) {
        rgba[opts.chans[i]] = opts.bezier[rgba[opts.chans[i]]];
      }
      
      return rgba;
    });
  };
  
  /*
   * Adjusts the exposure of the image by using the curves function.
   */
  Caman.manip.exposure = function (adjust) {
    var p, ctrl1, ctrl2;
    
    p = Math.abs(adjust) / 100;
    

    ctrl1 = [0, (255 * p)];
    ctrl2 = [(255 - (255 * p)), 255];
    
    if (adjust < 0) {
      ctrl1 = ctrl1.reverse();
      ctrl2 = ctrl2.reverse();
    }
    
    return this.curves('rgb', [0, 0], ctrl1, ctrl2, [255, 255]);
  };

}(Caman));

/*global Caman: true, exports: true */

/*
 * NodeJS compatibility
 */
if (!Caman && typeof exports == "object") {
	var Caman = {manip:{}};
	exports.plugins = Caman.manip;
}

(function (Caman) {

Caman.manip.boxBlur = function () {
  return this.processKernel('Box Blur', [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]);
};

Caman.manip.radialBlur = function () {
  return this.processKernel('Radial Blur', [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0]
  ], 5);
};

Caman.manip.heavyRadialBlur = function () {
  return this.processKernel('Heavy Radial Blur', [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0]
  ], 13);
};

Caman.manip.gaussianBlur = function () {
  return this.processKernel('Gaussian Blur', [
    [1, 4, 6, 4, 1],
    [4, 16, 24, 16, 4],
    [6, 24, 36, 24, 6],
    [4, 16, 24, 16, 4],
    [1, 4, 6, 4, 1]
  ], 256);
};

Caman.manip.motionBlur = function (degrees) {
  var kernel;
  
  if (degrees === 0 || degrees == 180) {
    kernel = [
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0]
    ];
  } else if ((degrees > 0 && degrees < 90) || (degrees > 180 && degrees < 270)) {
    kernel = [
      [0, 0, 0, 0, 1],
      [0, 0, 0, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 0, 0, 0],
      [1, 0, 0, 0, 0]
    ];
  } else if (degrees == 90 || degrees == 270) {
    kernel = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ];
  } else {
    kernel = [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1]
    ];
  }
  
  return this.processKernel('Motion Blur', kernel, 5);
};

Caman.manip.sharpen = function (amt) {
  if (!amt) {
    amt = 1;
  } else {
    amt /= 100;
  }
  
  return this.processKernel('Sharpen', [
    [0, -amt, 0],
    [-amt, 4 * amt + 1, -amt],
    [0, -amt, 0]
  ]);
};

}(Caman));
/*global Caman: true, exports: true */

/*
 * NodeJS compatibility
 */
if (!Caman && typeof exports == "object") {
	var Caman = {manip:{}};
	exports.plugins = Caman.manip;
}

(function (Caman) {
  
  Caman.manip.vignette = function (size, strength) {
    var center, start, end, loc, dist, div, bezier;
    
    if (!strength) {
      strength = 0.6;
    } else {
      strength /= 100;
    }
    
    center = [(this.dimensions.width / 2), (this.dimensions.height / 2)];
    
    // start = darkest part
    start = Math.sqrt(Math.pow(center[0], 2) + Math.pow(center[1], 2)); // corner to center dist
    
    // end = lightest part (0 vignette)
    end = start - size;
    
    //bezier = Caman.bezier([0, 100], [20, 50], [50, 0], [100, 0]);
    bezier = Caman.bezier([0, 1], [30, 30], [70, 60], [100, 80]);
    return this.process({center: center, start: start, end: end, size: size, strength: strength, bezier: bezier}, function vignette(data, rgba) {
      // current pixel coordinates
      loc = this.locationXY();
      
      // distance between center of image and current pixel
      dist = Math.sqrt(Math.pow(loc.x - data.center[0], 2) + Math.pow(loc.y - data.center[1], 2));
      
      if (dist > data.end) {
        // % of vignette
        div = Math.max(1, ((data.bezier[Math.round(((dist - data.end) / data.size) * 100)]/10) * strength));
        
        // Use gamma to adjust the vignette - much better results
        rgba.r = Math.pow(rgba.r / 255, div) * 255;
	      rgba.g = Math.pow(rgba.g / 255, div) * 255;
	      rgba.b = Math.pow(rgba.b / 255, div) * 255;
      }
      
      return rgba;
    });
  };
}(Caman));
/*global Caman: true, exports: true */

/*
 * NodeJS compatibility
 */
if (!Caman && typeof exports == "object") {
	var Caman = {manip:{}};
	exports.plugins = Caman.manip;
}

(function (Caman) {

Caman.manip.edgeEnhance = function () {
  return this.processKernel('Edge Enhance', [
    [0, 0, 0],
    [-1, 1, 0],
    [0, 0, 0]
  ]);
};

Caman.manip.edgeDetect = function () {
  return this.processKernel('Edge Detect', [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1]
  ]);
};

Caman.manip.emboss = function () {
  return this.processKernel('Emboss', [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2]
  ]);
};

}(Caman));
/*global Caman: true, exports: true */

/*
 * NodeJS compatibility
 */
if (!Caman && typeof exports == "object") {
  var Caman = {manip:{}};
  exports.plugins = Caman.manip;
}

(function (Caman) {

Caman.manip.vintage = function (vignette) {
  this
    .greyscale()
    .contrast(5);
  
  if (vignette || typeof vignette === 'undefined') {
    this.vignette(250, 25);
  }
  
  return this
    .noise(3)
    .sepia(100)
    .channels({red: 8, blue: 2, green: 4})
    .gamma(0.87);
};

Caman.manip.lomo = function() {
  return this
    .brightness(15)
    .exposure(15)
    .curves('rgb', [0, 0], [200, 0], [155, 255], [255, 255])
    .saturation(-20)
    .gamma(1.8)
    .vignette(300, 60)
    .brightness(5);
};

Caman.manip.clarity = function (grey) {
  var manip = this
    .vibrance(20)
    .curves('rgb', [5, 0], [130, 150], [190, 220], [250, 255])
    .sharpen(15)
    .vignette(250, 20);
    
   if (grey) {
     this
       .greyscale()
       .contrast(4);
   }
   
   return manip;
};

Caman.manip.sinCity = function () {
  return this
    .contrast(100)
    .brightness(15)
    .exposure(10)
    .curves('rgb', [0,0], [100, 0], [155, 255], [255, 255])
    .clip(30)
    .greyscale();
};

Caman.manip.sunrise = function () {
  return this
    .exposure(3.5)
    .saturation(-5)
    .vibrance(50)
    .sepia(60)
    .colorize('#e87b22', 10)
    .channels({red: 8, blue: 8})
    .contrast(5)
    .gamma(1.2)
    .vignette(250, 25);
};

Caman.manip.crossProcess = function () {
  return this
    .exposure(5)
    .colorize('#e87b22', 4)
    .sepia(20)
    .channels({blue: 8, red: 3})
    .curves('b', [0, 0], [100, 150], [180, 180], [255, 255])
    .contrast(15)
    .vibrance(75)
    .gamma(1.6);
};

Caman.manip.orangePeel = function () {
  return this
    .curves('rgb', [0, 0], [100, 50], [140, 200], [255, 255])
    .vibrance(-30)
    .saturation(-30)
    .colorize('#ff9000', 30)
    .contrast(-5)
    .gamma(1.4);
};

Caman.manip.love = function () {
  return this
    .brightness(5)
    .exposure(8)
    .colorize('#c42007', 30)
    .vibrance(50)
    .gamma(1.3);
};

Caman.manip.grungy = function () {
  return this
    .gamma(1.5)
    .clip(25)
    .saturation(-60)
    .contrast(5)
    .noise(5)
    .vignette(200, 30);
};

Caman.manip.jarques = function () {
  return this
    .saturation(-35)
    .curves('b', [20, 0], [90, 120], [186, 144], [255, 230])
    .curves('r', [0, 0], [144, 90], [138, 120], [255, 255])
    .curves('g', [10, 0], [115, 105], [148, 100], [255, 248])
    .curves('rgb', [0, 0], [120, 100], [128, 140], [255, 255])
    .sharpen(20);
};

Caman.manip.pinhole = function () {
  return this
    .greyscale()
    .sepia(10)
    .exposure(10)
    .contrast(15)
    .vignette(250, 35);
};

Caman.manip.oldBoot = function () {
  return this
    .saturation(-20)
    .vibrance(-50)
    .gamma(1.1)
    .sepia(30)
    .channels({red: -10, blue: 5})
    .curves('rgb', [0, 0], [80, 50], [128, 230], [255, 255])
    .vignette(250, 30);
};

Caman.manip.glowingSun = function () {
  this.brightness(10);
    
  this.newLayer(function () {
    this.setBlendingMode('multiply');
    this.opacity(10);
    this.copyParent();
    
    this.filter.gamma(0.8);
    this.filter.contrast(50);
    
    this.newLayer(function () {
      this.setBlendingMode('softLight');
      this.opacity(10);
      this.fillColor('#f49600');
      this.render();
    });
    
    this.filter.exposure(10);
          
    this.render();
  });
  
  this.exposure(20);
  this.gamma(0.8);
  
  return this.vignette(250, 20);
};

}(Caman));