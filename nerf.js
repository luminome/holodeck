const SVG_NS = "http://www.w3.org/2000/svg";
//https://jsfiddle.net/blr_Oliver/9Ld1m9vb/



// window.addEventListener('load', function(){
//   var
//     applyHandler = () => render(document.querySelector('svg'), document.querySelector('#path').value),
//     randomHandler = () => (document.querySelector('#path').value = randomCurve().toPath());

//   document.querySelector('#random').addEventListener('click', randomHandler);
//   document.querySelector('#apply').addEventListener('click', applyHandler);
  
//   randomHandler();
//   applyHandler();

//   //M -48.58 -28.96 C -231.13 -73.26 -76.17 -62.44 -51.66 -40.32
// });

function randomCurve(){
  var rs = () => rnd(0, 100), rl = () => rnd(-50, 150);
  return new Bezier(...[rs(), rs(), rl(), rl(), rl(), rl(), rs(), rs()].map(x => +x.toFixed(2)));
}

function rnd(from, to){
  return Math.random() * (to - from) + from;
}


const init_bez = () => {
    return new Bezier([0,0,0,0,0,0]);
}

const get_params = (bez, path_raw, bbox) => {
    const d = Math.hypot(bbox.width, bbox.height);
    bez.values = path_raw.slice(0, 8);
    return [
        createTangents(bez, 0, 1, d/2),
    ]
}

const get_c_params = (path, bbox) => {
    // console.log(path);
    // path = 'M -48.58 -28.96 C -231.13 -73.26 -76.17 -62.44 -51.66 -40.32'
    const bezier = Bezier.withPath(path);//,Bezier(...path);
    const d = Math.hypot(bbox.width, bbox.height);
    return [
        createTangents(bezier, 0, 1, d/2),
        // createTangents(bezier, 1, 0, d/2)
        // createTangents(bezier, 1, 1, d/2),
        // createTangents(bezier, -1, 1, d/2)
    ]
}

function render(svg, path){
  var
    bezier = Bezier.fromPath(path),
    bbox = bezier.getBBox(),
    d = Math.hypot(bbox.width, bbox.height);

  removeAll(svg);
  appendAll(svg,
      createSVGElement('path', {d: path}, 'curve'),
      createSVGElement('rect', bbox, 'box'),
      appendAll(createSVGElement('g', 0, 'key-points'),
          ...createTangents(bezier, 0, 1, d/2),
          ...createTangents(bezier, 1, 0, d/2),
          ...createTangents(bezier, 1, 1, d/2),
          ...createTangents(bezier, -1, 1, d/2)
      )
  )
}

function removeAll(parent, node){
  while(node = parent.lastChild)
    node.remove();
}

function appendAll(parent){
  [].slice.call(arguments, 1).forEach(node => parent.appendChild(node));
  return parent;
}

function createTangents(bezier, tx, ty, d){
    const creep = bezier.tangentPoints(tx, ty);
    const points = creep.filter(t => !!t).map(t => bezier.at(t));

  const k = d/2 / Math.hypot(tx, ty);

  if(points.length === 0) return undefined;

  return {
    dist: creep,
    points: [...points.map(p => ({cx:p[0], cy:p[1]}))],
    lines: [...points.map(p => ({x1: -k*tx, x2: k*tx, y1: -k*ty, y2: k*ty}))],
  }
}


function Polynom(...values){
  this.values = values || [];
}
Polynom.prototype = {
    get rank(){
      return this.values.length - 1;
    },
    clone: function(){
      return new Polynom(...this.values.slice());
    },
    at: function(t){
      return this.values.reduceRight(function(r, e){
        return r * t + e;
      }, 0);
    },
    multiplyScalar: function(s){
      for(var i = this.values.length - 1; i >= 0; --i)
        this.values[i] *= s;
      return this;
    },
    multiplyPoly: function(p){
      return this.multiplyValues(...p.values);
    },
    multiplyValues: function(...values){
      var newValues = Array(this.rank + values.length).fill(0);
      for(var i = 0; i < values.length; ++i)
        for(var j = 0; j <= this.rank; ++j)
          newValues[i + j] += values[i] * this.values[j];
      this.values = newValues;
      return this;
    },
    sumPoly: function(p){
      return this.sumValues(...p.values);
    },
    sumValues: function(...values){
      const l = Math.max(this.values.length, values.length);
      for(var i = 0; i < l; ++i)
        this.values[i] = (this.values[i] || 0) + (values[i] || 0);
      return this;
    },
    subtractPoly: function(p){
      return this.subtractValues(...p.values);
    },
    subtractValues: function(...values){
      const l = Math.max(this.values.length, values.length);
      for(var i = 0; i < l; ++i)
        this.values[i] = (this.values[i] || 0) - (values[i] || 0);
      return this;
    }
}

function Bezier(...values){
  this.values = values.slice(0, 8);
//   console.log(this.values);
}

Bezier.prototype = {
  at: function(t){
    var roller = (e, i, a) => (i < a.length - 2) && (e + (a[i + 2] - e)*t), data = this.values;
    for(; data.length > 2; data.length -= 2)
      data = data.map(roller);
    return data;
  },
  getPolynoms: function(rank){
    var polynoms = [
      [new Polynom(this.values[0]), new Polynom(this.values[1])],
      [new Polynom(this.values[2]), new Polynom(this.values[3])],
      [new Polynom(this.values[4]), new Polynom(this.values[5])],
      [new Polynom(this.values[6]), new Polynom(this.values[7])]
    ];
    for(let i = 0; i < rank; ++i) {
      polynoms = polynoms.map(function(e, i, a){
        if(i < a.length - 1)
          return [rollUp(e[0], a[i + 1][0]), rollUp(e[1], a[i + 1][1])];
      }).slice(0, -1);
    } 
    return polynoms;
    function rollUp(p1, p2){
      return p1.clone().multiplyValues(1, -1).sumPoly(p2.clone().multiplyValues(0, 1));
    }
  },
  tangentPoints: function(tx, ty){
    var mn = this.getPolynoms(2);
    var tangent = [mn[1][0].subtractPoly(mn[0][0]), mn[1][1].subtractPoly(mn[0][1])];
    var eq = tangent[0].multiplyScalar(ty).subtractPoly(tangent[1].multiplyScalar(tx));
    return solveQuadratic(...eq.values).filter(t => t >= 0 && t <= 1);
  },
  getBBox: function(){
    var horizontal = this.tangentPoints(0, 1), vertical = this.tangentPoints(1, 0);
    var t = [0, 1];
    if(horizontal.length && !isNaN(horizontal[0])) t = t.concat(horizontal);
    if(vertical.length && !isNaN(vertical[0])) t = t.concat(vertical);
    var points = t.map(t => this.at(t));
    var x = points.map(p => p[0]), y = points.map(p => p[1]);
    var box = {
        x: Math.min(...x),
        y: Math.min(...y)
    };
    box.width = Math.max(...x) - box.x;
    box.height = Math.max(...y) - box.y;
    return box;
  },
  toPath: function(){
    return ["M", this.values[0], this.values[1], "C", ...this.values.slice(2)].join(" ");
  }
}

Bezier.fromPath = function(d){
  return new Bezier(...d.split(/(?:[MC\s]|(?=-))+/).filter(e => !!e).map(Number));
}
Bezier.withPath = function(path){
    return new Bezier(...path);
}

function solveQuadratic(c, b, a){
  if(!a) return b ? [-c/b] : (c ? [] : [NaN]);
  let d = b*b - 4*a*c;
  if(d < 0) return [];
  if(d === 0) return [-b/2/a];
  d = Math.sqrt(d);
  return [(-b-d)/2/a, (-b+d)/2/a];
}


export { init_bez, get_params, get_c_params };