import { setAttrs, createSVGElement, resize_svg_paths, transform_svg_data, sortDomByDistance } from "./utils.js";
import { get_c_params } from "./nerf.js";
import { vec2 } from "gl-matrix";


const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;

const dark_colors = window.matchMedia("(prefers-color-scheme: light)").matches;
console.log('dark_colors', dark_colors);


function recalc(pts, line) {
    const ltx = line.p1.x,
    lty = line.p1.y,
    a = Math.atan2(line.p2.y - lty, line.p2.x - ltx);

    var tx = Math.cos(a);
    var ty = Math.sin(a);

    // var tx = Math.cos(wheel.angle);
    // var ty = Math.sin(wheel.angle);

    const tvals = [];

    var ax = 3*pts[3].x - 9*pts[2].x + 9*pts[1].x - 3*pts[0].x;
    var ay = 3*pts[3].y - 9*pts[2].y + 9*pts[1].y - 3*pts[0].y;
    var bx = 6*pts[2].x - 12*pts[1].x + 6*pts[0].x;
    var by = 6*pts[2].y - 12*pts[1].y + 6*pts[0].y;
    var cx = 3*pts[1].x - 3*pts[0].x;
    var cy = 3*pts[1].y - 3*pts[0].y;
    var den = 2*ax*ty - 2*ay*tx;
    if (Math.abs(den) < 1E-10) {
        var num = ax*cy - ay*cx;
        var den = ax*by - ay*bx;
        if (den != 0) {
            var t = -num / den;
            if (t >= 0 && t <= 1) tvals.push(t);
        }
    } else {
        var delta = (bx*bx - 4*ax*cx)*ty*ty + (-2*bx*by + 4*ay*cx + 4*ax*cy)*tx*ty + (by*by - 4*ay*cy)*tx*tx;
        var k = bx*ty - by*tx;
        
        if (delta >= 0 && den != 0) {
            var d = Math.sqrt(delta);
            var t0 = -(k + d) / den;
            var t1 = (-k + d) / den;
            if (t0 >= 0 && t0 < 1) tvals.push(t0);
            if (t1 >= 0 && t1 < 1) tvals.push(t1);
        }
        
    }
    //repaint();
    return tvals;
}





import { Bezier } from "bezier-js";
import { Vector } from "./vector.js";
const utils = Bezier.getUtils();

const test_curve_coords = [
    {x:0,y:0,z:0,t:0}, 
    {x:0,y:50,z:0}, 
    {x:50,y:100,z:0}, 
    {x:100,y:100,z:0,t:1}
]

let Point = Vector, test_curve, line;

const k = test_curve_coords.map((j) => [j.x,j.y,j.z]).flat();

const B = {
    curve: new Bezier(k),
    set(raw2d){
        let points = test_curve_coords.map((d,i) => {
            d.x = raw2d[i*2];
            d.y = raw2d[i*2+1];
            return d;
        })
        B.curve.points = points;
        B.curve.update();
    },
    exts(){
        const exts = B.curve.extrema();
        const cx = exts.x.map(t => B.curve.get(t));
        const cy = exts.y.map(t => B.curve.get(t));
        return [cx,cy]
    },
    tangential_exts(){


        utils.align()

    }
}

const C = {
    bez: B,
    raw: [],
    id: null,
    init(id){
        C.id = id;
    }
}



class v2 extends Array {
    constructor(...args) {
        super(...args);
        // this.a = new Float32Array(2);
        
        this[0] = args[0] ? args[0] : 0;
        this[1] = args[1] ? args[1] : 0;
    }
    // this[0] + o[0].map((e, i) => e + other[i]);
    // example methods
    add(o) {
        this[0] += o[0];
        this[1] += o[1]; 
        return this;
    }
    sub(o) {
        this[0] -= o[0];
        this[1] -= o[1]; 
        return this;
        // this[0] + o[0].map((e, i) => e + other[i]);
    }
    mul(s) {
        this[0] *= s;
        this[1] *= s; 
        return this;
        // this[0] + o[0].map((e, i) => e + other[i]);
    }
    set(other){
        // console.log(other);
        other.forEach((e, i) => this[i] = e);
        return this;
    }

}
  

let va = new v2();
let vb = new v2();
let vb2 = new v2();
let vc = new v2();
let vd = new v2();
let ve = new v2();

// 📌 primitive function;
function set_bez(bez, raw2d){
    bez.points.map((d,i) => {
        d.x = raw2d[i*2];
        d.y = raw2d[i*2+1];
    })
    bez.update();
}

// 📌 primitive function;
function get_bez_exts(bez){
    let exts, cx, cy;
    exts = bez.extrema();
    cx = exts.x.map(t => bez.get(t));
    cy = exts.y.map(t => bez.get(t));
    return [cx,cy];
}

function tangential_exts(src_bez, bez, line, flip=false){
    const rp = flip ? [...src_bez.points].reverse() : [...src_bez.points]; 
    bez.points = utils.align(rp, line);
    bez.update();
    return get_bez_exts(bez);
}

// 📌 primitive function;
function get_center(pv){
    let ax = 0, ay = 0, L = pv.length/2;
    for(let r = 0; r < L; r++){
        ax += pv[r*2];
        ay += pv[r*2+1];
    }

    // vec3.set(n,ax/pv.length, ay/pv.length, az/pv.length);//az/pv.length)
    //vec3.scale(n,n,1/pv.length);
    // [u,v,w].map((vc,i) => vec3.copy(vc, vec3.fromValues(pv[i][0],pv[i][1],pv[i][2])));
    // ///console.log(u,v,w);
    // vec3.sub(a,v,u);
    // vec3.sub(b,w,u);
    // vec3.cross(n,a,b);
  
    return [ax/L, ay/L];
  }



const lli8 = (x1,y1,x2,y2,x3,y3,x4,y4) => {
    let nx=(x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4),
        ny=(x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4),
        d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
        
    if (d === 0) return false;
    return {x:nx/d, y:ny/d};
}

const lli4 = (p1, p2, p3, p4) => {
    let x1 = p1.x, y1 = p1.y,
        x2 = p2.x, y2 = p2.y,
        x3 = p3.x, y3 = p3.y,
        x4 = p4.x, y4 = p4.y;
    return lli8(x1,y1,x2,y2,x3,y3,x4,y4);
}

const lli = (line1, line2) => lli4(line1.p1, line1.p2, line2.p1, line2.p2);




const N = {
    dom: undefined,
    bounds: undefined,
    tester: createSVGElement("path", {"visibility":"hidden"}, "tester"),
    bez: new Bezier(k),
    curves:[],
    rota: undefined,
    drawing:{
        randies: 0,
    },

    setPoint(i, pos, label=''){
        const p = N.dom.querySelector(`g#connect-${i}`);
        if(p){
            p.style.visibility = 'visible';
            setAttrs(p,{transform:`translate(${pos[0]}, ${pos[1]})`});
        }
    },
    update_control_points(P, n0, n1){
        const [a, b] = [P._path_data[n0], P._path_data[n1]];
        const [ao, bo] = [P._path_data_og[n0], P._path_data_og[n1]];
        // console.log(a,b);
        
        const buf_b = P._buffer_data.map.get(n1);
        const ctrl = P._control_points.get(buf_b[3]);

        if(a && b){
            let raw = a.values.length > 2 ? [a.values[4],a.values[5]] : [a.values[0],a.values[1]];
            raw.push(...b.values);

            let raw_og = ao.values.length > 2 ? [ao.values[4],ao.values[5]] : [ao.values[0],ao.values[1]];
            raw_og.push(...bo.values);
            raw_og = raw_og.map((v) => v*100);
            let super_raw = [];
            for(let j=0; j<raw_og.length/2; j++){
                const [x,y] = [raw_og[j*2], raw_og[j*2+1]];
                const nx = x*Math.cos(N.rota) - y*Math.sin(N.rota);
                const ny = y*Math.cos(N.rota) + x*Math.sin(N.rota);
                super_raw.push(nx,ny);
            }




            set_bez(ctrl.bez_og, super_raw);


            set_bez(ctrl.bez, raw);


            ctrl._ctrlpts = get_bez_exts(ctrl.bez);
            ctrl._coords = raw;
            ctrl._id = buf_b[3];
            return ctrl;
        }
        return undefined;
    },
    validate(part, i, i2){
        return [i, i2].map((n) => {
            const c = part._buffer_data.map.get(n);
            return c ? c[0] === 'C' : false;    
        }).reduce((a,b) => a || b);
    },
    getCurveSupportsAtIndex(i, Len, part1, part2){
        let a = i,
        a2 = i + 1,
        b = Len - a2,
        b2 = b - 1,
        C1,
        C2;
        if([a,a2,b,b2].indexOf(-1) !== -1) return undefined;

        if(N.validate(part1, a, a2) && N.validate(part2, b2, b)){
            C1 = N.update_control_points(part1, a, a2);
            C2 = N.update_control_points(part2, b2, b);
            return [C1, C2];
        }else{
            return undefined;
        }
    },
    re_init_draw(){
        N.drawing.randies = 0;
        N.drawing.paths = 0;
        N.dom.querySelectorAll(`.randy`).forEach((r) => setAttrs(r,{visibility: "hidden"}));
        N.dom.querySelectorAll(`.con_line`).forEach((r) => setAttrs(r,{visibility: "hidden"}));
        N.dom.querySelectorAll(`.chk_path`).forEach((r) => setAttrs(r,{visibility: "hidden"}));
        N.dom.querySelectorAll(`.chk_rect`).forEach((r) => setAttrs(r,{visibility: "hidden"}));
    },
    re_draw(ctrl){
        const bx = ctrl.bez.bbox();
        // console.log(N.rota);

        ctrl._bmid = new Vector(bx.x.mid, bx.y.mid, 0);
        ctrl._aspect = bx.x.size/bx.y.size;
        ctrl._bx = bx;

        // const m_path_box = N.dom.querySelectorAll(`.chk_rect`)[N.drawing.randies];
        // // console.log(m_path_box);
        // setAttrs(m_path_box,{
        //     visibility: "visible",
        //     x: bx.x.min,
        //     y: bx.y.min,
        //     width: bx.x.size,
        //     height: bx.y.size,
        // });
        // N.drawing.randies++;

        const op1 = new Vector(ctrl.bez.points[0]);
        const ep1 = new Vector(ctrl.bez.points[3]);
        ctrl._bmid = ep1.subtract(op1).scale(0.5).add(op1);




        let pt = [0,1,3,2];
        let lines = [];
        let ct_pts = [];

        for(let p=0;p<2;p++){
            const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
            let a2 = new Vector(ctrl.bez.points[pt[p*2]]);
            let b2 = new Vector(ctrl.bez.points[pt[p*2+1]]);
            setAttrs(line,{
                visibility: "visible",
                stroke: 'blue',
                'stroke-width': 2,
                'stroke-opacity': 0.3,
                x1:a2.x,
                y1:a2.y,
                x2:b2.x,
                y2:b2.y
            })
            ct_pts.push(b2);
            N.drawing.randies++;


            let n1 = b2.subtract(a2).scale(2.0).add(a2);
            const line2 = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];

            setAttrs(line2,{
                visibility: "visible",
                stroke: 'gray',
                'stroke-width': 1,
                'stroke-opacity': 0.3,
                x1:a2.x,
                y1:a2.y,
                x2:n1.x,
                y2:n1.y
            })
            N.drawing.randies++;
            lines.push({p1:a2,p2:n1});
        }

        ctrl._ctpoints = ct_pts;

        ctrl._inter = lli(lines[0],lines[1]);

        if(ctrl._inter){
            const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
            setAttrs(rand, {
                visibility: "visible",    
                r:4,
                fill:'black',        
                cx: ctrl._inter.x,
                cy: ctrl._inter.y
            })
            N.drawing.randies++;
        }

       ctrl._ctrlpts.map((e,i) => {
            // const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];

            if(i === 0) ctrl._ext_x = e;//(e[0]) ? e[0] : null;
            if(i === 1) ctrl._ext_y = e;//(e[0]) ? e[0] : null;

            // if(e[0]){
            //     setAttrs(rand,{
            //         visibility: "visible",
            //         fill: i === 0 ? 'red' : 'green',
            //         r: i === 0 ? 6 : 6,
            //         cx:e[0].x,
            //         cy:e[0].y
            //     })
            //     N.drawing.randies++;
            // }
        });

        // const svg = [
        //     {type:'M', values:[ctrl._coords[0],ctrl._coords[1]]},
        //     {type:'C', values:ctrl._coords.slice(2)}
        // ];

        // const a_path = N.dom.querySelectorAll(`.chk_path`)[ctrl.index];
        // a_path.setPathData(svg);
        // setAttrs(a_path,{visibility: "visible"});
    },

    get_point(pt, att = {}){
        const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        const pt_def = {
            visibility: "visible",
            fill: "black",
            r: 4,
            cx:pt.x,
            cy:pt.y
        }
        Object.assign(pt_def, att);
        setAttrs(rand, pt_def);
        N.drawing.randies++;
    },
    get_line(line, att = {}){
        console.log(line);

        const rand = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        const pt_def = {
            visibility: "visible",
            fill: "black",
            x1:line.p1.x,
            y1:line.p1.y,
            x2:line.p2.x,
            y2:line.p2.y
        }
        Object.assign(pt_def, att);
        setAttrs(rand, pt_def);
        N.drawing.randies++;
    },
    re_update(part, part_mirror){
        const debug = true;
        //✅ @ LIKELY NEED TO ABANDON USING A 2-D NORMLA TO FIND CURVE POINT.
        //🗒️ in short order need to know if the point is (0) a curve and (1) if it needs treatment.
        //🗒️ z-position of given point will need to be considered. it can establish winding-order.
        //🗒️ criteria for aaplicability of this function are not clear.


        debug && N.re_init_draw();
        const Len = part._path_data.length-1; //skip Z...
        return;
        // let refs = [5,6,8,3];//2,6,7];//[2,3,5];

        for(let u = 0; u < Len; u++){
            if(!refs.includes(u)) continue;

        // [2,3,5].forEach(sel_index => {
            const sel_index = u;
            

            
            const [a, b] = N.getCurveSupportsAtIndex(sel_index, Len, part, part_mirror);
            const batch = [a, b];
            // console.log(a,b);





            const ray_a = [];


            let ext_ray = [];

            debug && batch.forEach((ctrl, i) => {
                N.re_draw(ctrl);

                [ctrl._ext_x, ctrl._ext_y].forEach((ext, axis) => {
                    if(ext){
                        ext.sort((a,b) => i === 0 ? a.t - b.t : b.t - a.t);
                        ext.forEach((pt,nL) => {
                            N.get_point(pt,{fill:axis === 1 ? 'blue' : 'red', r:axis === 0 ? 4 : 4});
                            nL === 0 && axis === 0 && ext_ray.push(pt);
                        });
                    }

                })

            });

            if(ext_ray.length === 2){
                let a1 = new Vector(ext_ray[0]);
                let b1 = new Vector(ext_ray[1]);
                let o = a1.subtract(b1).scale(-4.0);
                let a2 = a1.subtract(o);
                let b2 = b1.add(o);

                const p_line = {p1:a2 , p2:b2};

                N.get_line(p_line,{
                    'stroke-width': 1,
                    'stroke-opacity': 1.0,
                    'stroke':'black',
                });

                // setAttrs(line,{
                //     visibility: "visible",
                //     'stroke-width': 1,
                //     'stroke-opacity': 1.0,
                //     stroke:'black',
                //     x1:a2.x,
                //     y1:a2.y,
                //     x2:b2.x,
                //     y2:b2.y
                // });
                // N.drawing.randies++;


                // const p_line = {p1:a2 , p2:b2}

                // batch.forEach((ctrl, i) => {
                //     const inter = ctrl.bez.intersects(p_line);
                //     const kt = (inter[1] - inter[0]) / 2;
                //     const st = [inter[0], inter[1], inter[0]+kt];

                //     st.forEach((t,ti) => {
                //         const pt = ctrl.bez.get(t);
                //         N.get_point(pt,{
                //             fill: ti === 2 ? 'green' : 'none',    
                //             stroke:'black',
                //             r: 6
                //         });
                //     });




                // });

                // const inter = a.bez.intersects(p_line);
                // const kt = (inter[1] - inter[0]) / 2;
                // const st = [inter[0], inter[1], inter[0]+kt];


                // st.forEach((t,ti) => {
                //     // this.drawPoint()
                //     const pt = b.bez.get(1-t);

                //     N.get_point(pt,{
                //         fill: ti === 2 ? 'green' : 'none',    
                //         stroke:'black',
                //         r: 6
                //     });
                    


                    
                
                // });


            }

            // const a_line_obj = {p1:ray_a[0], p2:{x:ray_a[1].x,y:300,z:0.0}};
            // const c_line_obj = {p1:ray_a[0], p2:ray_a[1]};


            // let a_line_obj = {
            //     p1:a._ctpoints[0],
            //     p2:b._ctpoints[1]
            // }

            // let b_line_obj = {
            //     p1:a._ctpoints[1],
            //     p2:b._ctpoints[0]
            // }

            // const r = [a_line_obj, b_line_obj];

            // r.forEach((side, i) =>{
            //     //if(i === 0){
            //         let surf = [];

            //         [a,b].forEach((c,ci) => {
            //             //if(ci === 0){
            //                 const ext = tangential_exts(c.bez, N.bez, side);

            //                 ext.forEach((nn,L) => {
            //                     nn.forEach((n,nL) => {
            //                         const ht = n.t;
            //                         const pt = c.bez.get(ht);

            //                         const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
            //                         setAttrs(rand, {
            //                             visibility: "visible",        
            //                             fill: L === 0 ? 'green' : i === 0 ? 'blue' : 'red',    
            //                             r: L === 0 ? 2 : 4,
            //                             cx:pt.x,
            //                             cy:pt.y
            //                         });
            //                         N.drawing.randies++;

            //                         L === 1 && surf.push(pt);
            //                     });
            //                 });
            //             //}
            //         });
            //     //}
            // });

        };


            // let surf = [];

            // if(a && b){
            //     [a,b].forEach((c,ci) => {
            //         const ct_line_obj = ci === 0 ? a_line_obj : b_line_obj;
            //         let aext = tangential_exts(c.bez, N.bez, ct_line_obj);

            //         aext.forEach((nn,L) =>{
            //             // console.log(n.length);
            //             nn.forEach((n,nL) => {

            //                 if(n){
            //                     const ht = n.t;//ci === 0 ? (n[0].t*0.5) : (1-(n[0].t*0.5));
            //                     // console.log(ht);

            //                     const pt = c.bez.get(ht);

            //                     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
            //                     setAttrs(rand, {
            //                         visibility: "visible",        
            //                         fill: L === 0 ? 'green' : nL === 0 ? 'red' : 'blue',    
            //                         r: L === 0 ? 4 : 8,
            //                         cx:pt.x,
            //                         cy:pt.y
            //                     });
            //                     N.drawing.randies++;

            //                     // L === 1 && surf.push(pt);
            //                 }
            //             })

            //         });

            //     });








                
            // }

        //     if(surf.length === 2){
        //         const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];


        //         let a1 = new Vector(surf[0]);
        //         let b1 = new Vector(surf[1]);
        //         let o = a1.subtract(b1).scale(-0.25);
        //         let a2 = a1.subtract(o);
        //         let b2 = b1.add(o);
        //         setAttrs(line,{
        //             visibility: "visible",
        //             'stroke-width': 1,
        //             stroke:'black',
        //             x1:a2.x,
        //             y1:a2.y,
        //             x2:b2.x,
        //             y2:b2.y
        //         });
        //         N.drawing.randies++;


        //         // const p_line = {p1:a2 , p2:b2}
        //         // a.bez.intersects(p_line).forEach(t => {
        //         //     // this.drawPoint()
        //         //     const pt = a.bez.get(t);
        //         //     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //         //     setAttrs(rand, {
        //         //         visibility: "visible",        
        //         //         fill: 'none',    
        //         //         stroke:'black',
        //         //         r: 6,
        //         //         cx:pt.x,
        //         //         cy:pt.y
        //         //     });
        //         //     N.drawing.randies++;
                
        //         // });





        //     }

        
        // const ap1 = new Vector(a._coords[0], a._coords[1]);
        // const ap2 = new Vector(b._coords[6], b._coords[7]);
        // const a_line_obj = {p1:ap1, p2:ap2};

        // const bp1 = new Vector(a._coords[6], a._coords[7]);
        // const bp2 = new Vector(b._coords[0], b._coords[1]);
        // const b_line_obj = {p1:bp1, p2:bp2};



        // const c_line_obj = {
        //     p1:{x:a._bx.x.max, y:a._bx.y.max, z:1.0},
        //     p2:{x:b._bx.x.max, y:b._bx.y.max, z:-1.0}
        // }

        // const d_line_obj = {
        //     p1:a._inter,
        //     p2:b._inter
        // }

        // const f_line_obj = {
        //     p1:a._ctpoints[0],
        //     p2:b._ctpoints[1]
        // }

        // const f2_line_obj = {
        //     p1:a._ctpoints[1],
        //     p2:b._ctpoints[0]
        // }

        // // const ap1 = new Vector(a._coords[0], a._coords[1]);
        // // const ap2 = new Vector(a._coords[6], a._coords[7]);
        // // const a_line_obj = {p1:ap2, p2:ap1};

        // // const bp1 = new Vector(b._coords[6], b._coords[7]);
        // // const bp2 = new Vector(b._coords[0], b._coords[1]);
        // // const b_line_obj = {p1:bp1, p2:bp2};

        // // if(a._ext_x && b._ext_x){
        // // const c_line_obj = {p1:a._ext_x, p2:b._ext_x};


        // const aext = recalc(a.bez.points, f_line_obj);
        // const bext = recalc(b.bez.points, f_line_obj);
        // const aext2 = recalc(a.bez.points, f2_line_obj);
        // const bext2 = recalc(b.bez.points, f2_line_obj);

        // const asp = b._aspect/a._aspect;
        // const ra = aext[0] + (aext2[0]-aext[0])/2;
        // const rb = bext[0] + (bext2[0]-bext[0])/2;

        // const pa = aext[0] ? a.bez.get(aext[0]) : null;
        // const pb = bext[0] ? b.bez.get(bext[0]) : null;
        // const pa2 = aext2[0] ? a.bez.get(aext2[0]) : null;
        // const pb2 = bext2[0] ? b.bez.get(bext2[0]) : null;

        // const pa3 = ra ? a.bez.get(ra) : null;
        // const pb3 = rb ? b.bez.get(rb) : null;

        // if(pa3 && pb3){
        //     //if(pa && pb){
        //         [pa3, pb3].forEach((pt) => {

        //             const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];

        //             setAttrs(rand, {
        //                 visibility: "visible",        
        //                 fill: 'black',    
        //                 r:3,
        //                 cx:pt.x,
        //                 cy:pt.y
        //             });
        //             N.drawing.randies++;

        //         });
        //     //}

        //     // if(pa && pb){
        //     //     [pa,pb].forEach((pt) => {

        //     //         const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];

        //     //         setAttrs(rand, {
        //     //             visibility: "visible",        
        //     //             fill: 'black',    
        //     //             r:3,
        //     //             cx:pt.x,
        //     //             cy:pt.y
        //     //         });
        //     //         N.drawing.randies++;

        //     //     });
        //     // }
        //     // if(pa2 && pb2){
        //     //     [pa2,pb2].forEach((pt) => {

        //     //         const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];

        //     //         setAttrs(rand, {
        //     //             visibility: "visible",        
        //     //             fill: 'black',    
        //     //             r:4,
        //     //             cx:pt.x,
        //     //             cy:pt.y
        //     //         });
        //     //         N.drawing.randies++;

        //     //     })
        //     // }
        //     const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];


        //     let a1 = new Vector(pa3);
        //     let b1 = new Vector(pb3);
        //     let o = a1.subtract(b1).scale(-2.0);
        //     let a2 = a1.subtract(o);
        //     let b2 = b1.add(o);
        //     setAttrs(line,{
        //         visibility: "visible",
        //         x1:a2.x,
        //         y1:a2.y,
        //         x2:b2.x,
        //         y2:b2.y
        //     })

        //     // setAttrs(line,{
        //     //     visibility: "visible",
        //     //     'stroke-width': 1,
        //     //     'stroke': 'black',
        //     //     x1:pa.x,
        //     //     y1:pa.y,
        //     //     x2:pb2.x,
        //     //     y2:pb2.y
        //     // })
        //     N.drawing.randies++;

        // }

        //✅ @ t = 0, you want the full edge.
        //✅ @ t = 1, you want the full bottom-edge.
        // //NEED BOTH EDGES.

        // const asp = a._aspect/b._aspect;
        // // console.log(asp);


        // const ap1 = new Vector(a._coords[0], a._coords[1]);
        // const ap2 = new Vector(b._coords[6], b._coords[7]);
        // const a_line_obj = {p1:ap1, p2:ap2};

        // const bp1 = new Vector(a._coords[6], a._coords[7]);
        // const bp2 = new Vector(b._coords[0], b._coords[1]);
        // const b_line_obj = {p1:bp1, p2:bp2};


        // const f_line_obj = {p1:ap1, p2:bp2};
        // if(a._lext){
        //     const k_ap1 = ap1.scale(1-a._lext);
        //     const k_ap2 = ap2.scale(1-a._lext);
        //     const k_bp1 = bp1.scale(a._lext);
        //     const k_bp2 = bp2.scale(a._lext);
        //     const p1 = k_ap1.add(k_bp1);
        //     const p2 = k_ap2.add(k_bp2);
        //     c_line_obj.p1 = p1;
        //     c_line_obj.p2 = p2;
        // }

        // let a1,a2,b1,b2;
        // let ee = [[],[]];

        // const aext = recalc(a.bez.points, c_line_obj);
        // const bext = recalc(b.bez.points, c_line_obj);

        // console.log('a', aext);
        // console.log('b', bext);



        // const aext = tangential_exts(a.bez, N.bez, a_line_obj);
        // const bext = tangential_exts(b.bez, N.bez, b_line_obj);

        // const aT = [0,0];
        // const bT = [0,0];


        // [aext, bext].forEach((nxt, n) => {
        //     nxt.forEach((ed, i) => {
        //         if(i === 1 && ed[0]){
        //             aT[n] = ed[0].t;
        //             const p = n === 0 ? a.bez.get(ed[0].t) : b.bez.get(ed[0].t);
        //             const q = n === 0 ? b.bez.get((1-ed[0].t)) : a.bez.get(1-ed[0].t);
        //             ee[n].push(p,q);
        //         }
        //     });
        // });


        // // console.log(aT[0],1-aT[1]);
        // const ni = 1;//1-aT[1] >= aT[0] ? 1 : 0;

        // ee[0].forEach((pt) => {
        //     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //     setAttrs(rand, {
        //         visibility: "visible",        
        //         fill: 'red',    
        //         cx:pt.x,
        //         cy:pt.y
        //     });
        //     N.drawing.randies++;
        // })

        // ee[1].forEach((pt) => {
        //     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //     setAttrs(rand, {
        //         visibility: "visible",        
        //         fill: 'blue',    
        //         cx:pt.x,
        //         cy:pt.y
        //     });
        //     N.drawing.randies++;
        // })

        // if(ee[1].length === 2){
        //     const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        //     setAttrs(line,{
        //         visibility: "visible",
        //         'stroke-width': 1,
        //         'stroke': 'black',
        //         x1:ee[1][0].x,
        //         y1:ee[1][0].y,
        //         x2:ee[1][1].x,
        //         y2:ee[1][1].y
        //     })
        //     N.drawing.randies++;
        // }
        // [aext, bext].map((nxt, n) => {

        //     nxt.map((ed,i) => {
        //         if(ed[0]){
        //             // const pt = a.bez.get(ed[0].t);
        //             // const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //             // setAttrs(rand, {
        //             //     visibility: "visible",        
        //             //     fill: i === 0 ? 'blue' : 'green',    
        //             //     cx:pt.x,
        //             //     cy:pt.y
        //             // });
        //             // N.drawing.randies++;
    
        //             if(i === 1){
        //                 // const np = aext[0][0];
        //                 // const p = a.bez.get(ed[0].t);
        //                 // const q = b.bez.get(1-ed[0].t);
        //                 const p = n === 0 ? a.bez.get(ed[0].t) : b.bez.get(ed[0].t);
        //                 const q = n === 0 ? b.bez.get(1-ed[0].t) : a.bez.get(1-ed[0].t);
    
        //                 [p,q].map((pt,i) => {
        //                     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //                     setAttrs(rand, {
        //                         visibility: "visible",        
        //                         fill: 'red',
        //                         "fill-opacity": 1.0,
        //                         cx:pt.x,
        //                         cy:pt.y
        //                     });
        //                     N.drawing.randies++;
        //                 })
    
    
    
        //                 const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        //                 setAttrs(line,{
        //                     visibility: "visible",
        //                     'stroke-width': 4,
        //                     'stroke':'red',
        //                     x1:p.x,
        //                     y1:p.y,
        //                     x2:q.x,
        //                     y2:q.y
        //                 })
        //                 N.drawing.randies++;
    
        //             }
    
        //         }
        //     })

        // })

        


        // if(aext[0][0]){
        //     const np = aext[0][0];
        //     const p = a.bez.get(np.t);
        //     const q = b.bez.get(1-np.t);

        //     [p,q].map((pt,i) => {
        //         const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //         setAttrs(rand, {
        //             visibility: "visible",        
        //             fill: i === 0 ? 'blue' : 'green',    
        //             cx:pt.x,
        //             cy:pt.y
        //         });
        //         N.drawing.randies++;
        //     })

        //     ray_b = [p,q];

        // }


        // a._lext = aext[0][0] ? aext[0][0].t : 0.0;
        // console.log(a._lext);


        // const bext = tangential_exts(b.bez, N.bez, b_line_obj);

        // [aext, bext].forEach((ex,i) => {
        //     ex.forEach((e,j) => {
        //         // if(j===0){ //xonly
        //             if(e[j]){
        //                 const p = i === 0 ? a.bez.get(e[j].t) : b.bez.get(e[j].t);
        //                 const q = i === 0 ? b.bez.get(1-e[j].t) : a.bez.get(1-e[j].t);
        //                 [p,q].map((pt) => {
        //                     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //                     setAttrs(rand, {
        //                         visibility: "visible",        
        //                         fill: i === 0 ? 'red' : 'green',    
        //                         cx:pt.x,
        //                         cy:pt.y
        //                     });
        //                     N.drawing.randies++;
        //                 })

        //                 i === 0 && (ray_b = [p,q]);
        //             }
        //         // }
        //     })

        // });


        // if(ray_b.length === 2){
        //     const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        //     // const line_obj = {p1:ray[0], p2:ray[1]};

        //     let a1 = new Vector(ray_b[0]);
        //     let b1 = new Vector(ray_b[1]);
        //     let o = a1.subtract(b1).scale(-0.5);
        //     let a2 = a1.subtract(o);
        //     let b2 = b1.add(o);
        //     setAttrs(line,{
        //         visibility: "visible",
        //         x1:a2.x,
        //         y1:a2.y,
        //         x2:b2.x,
        //         y2:b2.y
        //     })
        //     N.drawing.randies++;
        // }


        // const ap1 = new Vector(a._coords[0], a._coords[1]);
        // const ap2 = new Vector(am._coords[6], am._coords[7]);
        // const ap1 = new Vector(a._coords[6], a._coords[7]);
        // const ap2 = new Vector(am._coords[0], am._coords[1]);
        // const a_line_obj = {p1:ap1, p2:ap2};
        // const at_ext = tangential_exts(a.bez, N.bez, a_line_obj);






        
        // if(at_ext[0]){
        //     const npt = at_ext[0][0];
        //     if(npt){
        //         const apt = a.bez.get(npt.t);
        //         const bpt = am.bez.get(1-npt.t);
        //         ray_b = [apt, bpt];

        //         ray_b.map((r) => {
        //             const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //             setAttrs(rand, {
        //                 visibility: "visible",            
        //                 cx:r.x,
        //                 cy:r.y
        //             })
        //             N.drawing.randies++;
        //         })

        //         const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        //         setAttrs(line,{
        //             visibility: "visible",
        //             x1:ray_b[0].x,
        //             y1:ray_b[0].y,
        //             x2:ray_b[1].x,
        //             y2:ray_b[1].y
        //         })
        //         N.drawing.randies++;
        //     }
        // }


        // console.log(ray);

        // if(ray_a.length === 2){


            // // const a_line_obj = {p1:ray_a[0], p2:ray_a[1]};
            // const at_ext = tangential_exts(a.bez, N.bez, a_line_obj);
            // const amt_ext = tangential_exts(am.bez, N.bez, a_line_obj);

            // [at_ext, amt_ext].forEach((ex,i) => {
            //     ex.forEach((e,j) => {
            //         if(j===0){ //xonly
            //             if(e[j]){
            //                 const p = i === 0 ? a.bez.get(e[j].t) : am.bez.get(e[j].t);
            //                 // console.log(p);
            //                 const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
            //                 setAttrs(rand, {
            //                     visibility: "visible",            
            //                     cx:p.x,
            //                     cy:p.y
            //                 });
            //                 N.drawing.randies++;
            //                 ray_b.push(p);
            //             }
            //         }
            //     })

            // });

            // if(ray_b.length === 2){
            //     const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
            //     setAttrs(line,{
            //         visibility: "visible",
            //         x1:ray_b[0].x,
            //         y1:ray_b[0].y,
            //         x2:ray_b[1].x,
            //         y2:ray_b[1].y
            //     })
            //     N.drawing.randies++;
            // }



        // }

        




                // // [part, part_mirror].map((P)=>{
        // //     N.tester.setPathData(P._path_data);
        // //     const bnd = N.tester.getBBox();
        // //     P.CE = [bnd.x + bnd.width/2, bnd.y + bnd.height/2];
        // // })

        // const ap1 = new Vector(a._coords[0], a._coords[1]);
        // const ap2 = new Vector(am._coords[6], am._coords[7]);
        // // const p1 = ap2.subtract(ap1).scale(-0.5).add(ap2);

        // const amp2 = new Vector(a._coords[6], a._coords[7]);
        // const amp1 = new Vector(am._coords[0], am._coords[1]);
        
        // // const p2 = amp2.subtract(amp1).scale(-0.5).add(amp2);

        // // const p2 = new Vector(am._coords[0], am._coords[1]);
        // // const p1 = a.bez.get(0.5);//new Vector(a._coords[6], a._coords[7]);
        // // const p2 = am.bez.get(0.5);//new Vector(am._coords[0], am._coords[1]);

        // // console.log
        // const a_line_obj = {p1:ap2, p2:ap1};
        // const am_line_obj = {p1:amp1, p2:amp2};
        // // console.log(a_line_obj,)
        // const at_ext = tangential_exts(a.bez, N.bez, a_line_obj);
        // const amt_ext = tangential_exts(am.bez, N.bez, a_line_obj);

        // // const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        // // setAttrs(line,{
        // //     visibility: "visible",
        // //     x1:p1.x,
        // //     y1:p1.y,
        // //     x2:p2.x,
        // //     y2:p2.y
        // // })
        // // N.drawing.randies++;

        // const final = [];
        // [at_ext, amt_ext].forEach((ex,i) => {
        //     ex.forEach((e,j) => {
        //         //if(j===0){ //xonly
        //             if(e[j]){
        //                 const p = i === 0 ? a.bez.get(e[j].t) : am.bez.get(e[j].t);
        //                 console.log(p);
        //                 const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //                 setAttrs(rand, {
        //                     visibility: "visible",            
        //                     cx:p.x,
        //                     cy:p.y
        //                 });
        //                 N.drawing.randies++;
        //                 final.push(p);
        //             }
        //         //}
        //     })

        // });

        // if(final.length === 2){
        //     const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        //     setAttrs(line,{
        //         visibility: "visible",
        //         x1:final[0].x,
        //         y1:final[0].y,
        //         x2:final[1].x,
        //         y2:final[1].y
        //     })
        //     N.drawing.randies++;
        // }

        // if(at_ext[0][0]){
        //     const p = a.bez.get(at_ext[0][0].t);
        //     const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //     setAttrs(rand, {
        //         visibility: "visible",            
        //         cx:p.x,
        //         cy:p.y
        //     });
        //     N.drawing.randies++;
        // }




        // [a, am].forEach((ctrl) => {
        //     ctrl._ctrlpts.forEach((e,i) => {
        //         if(i === 0) ctrl._ext_x = e[0] ? e[0] : null;
        //     });
        //     N.re_draw(ctrl);
        //     if(ctrl._ext_x) ray.push(ctrl._ext_x);
        // });

        // if(ray.length === 2){
        //     const line = N.dom.querySelectorAll(`.con_line`)[N.drawing.randies];
        //     const line_obj = {p1:ray[0], p2:ray[1]};

        //     let a1 = new Vector(ray[0]);
        //     let b1 = new Vector(ray[1]);
        //     let o = a1.subtract(b1).scale(-0.1);
        //     let a2 = a1.subtract(o);
        //     let b2 = b1.add(o);
        //     setAttrs(line,{
        //         visibility: "visible",
        //         x1:a2.x,
        //         y1:a2.y,
        //         x2:b2.x,
        //         y2:b2.y
        //     })
        //     N.drawing.randies++;

        //     const t_ext = tangential_exts(a.bez, N.bez, line_obj);
        //     console.log(t_ext);

        //     if(t_ext[0][0]){
        //         const p = a.bez.get(t_ext[0][0].t);

        //         const rand = N.dom.querySelectorAll(`.randy`)[N.drawing.randies];
        //         setAttrs(rand, {
        //             visibility: "visible",            
        //             cx:p.x,
        //             cy:p.y
        //         })

        //     }


        // }








        // console.log(part);
        // console.log(part_mirror);
        // return;

        // const Len = part._path_data.length-1; //skip Z...
        // let a, b, a2, b2, C1;

        // // [part, part_mirror].map((P)=>{
        // //     N.tester.setPathData(P._path_data);
        // //     const bnd = N.tester.getBBox();
        // //     P.CE = [bnd.x + bnd.width/2, bnd.y + bnd.height/2];
        // // })

        // let randies = 0, extents, p1, p2;
        // N.dom.querySelectorAll(`.randy`).forEach((r) => setAttrs(r,{visibility: "hidden"}));
        // N.dom.querySelectorAll(`.con_line`).forEach((r) => setAttrs(r,{visibility: "hidden"}));

        // //✅ step one: get ray that connects extrema of concerned curves; C1,C2.
        // //✅ step two: from index of C1, find next index where ray intersects curve at index.
        // //✅ step three: (should this be running in stereo?) construct extrema -> intersection curve.
        // //if p1.y > p2.y dir = +1 else dir = -1;



        // for(let i = 0; i < Len; i++){
        //     //no inversions
        //     a = i;
        //     a2 = i + 1;
        //     b = Len - a2;
        //     b2 = b - 1;
        //     if([a,a2,b,b2].indexOf(-1) !== -1) continue;

        //     const valid = N.validate(part, a, a2) && N.validate(part_mirror, b, b2);
            
            
        //     const a_path = N.dom.querySelectorAll(`.chk_path`)[i];
        //     const b_path = N.dom.querySelectorAll(`.chk_path`)[i+Len];
        //     // return;
        //     if(valid){
        //         let p1 = null, p2 = null;
        //         // console.log(a,a2,b,b2,valid);

        //         C1 = N.convert(part, a, a2);
        //         N.bez.set(C1.raw);
        //         N.bez.exts().map((e,i)=>{
        //             if(i === 0 && e[0]) p1 = e[0];
        //             const rand = N.dom.querySelectorAll(`.randy`)[randies];
        //             if(e[0]){
        //                 setAttrs(rand,{
        //                     visibility: "visible",
        //                     fill: i === 0 ? 'red' : 'green',
        //                     r: i === 0 ? 6 : 3,
        //                     cx:e[0].x,
        //                     cy:e[0].y
        //                 })
        //                 randies++;
        //             }
        //         });

        //         a_path.style.visibility = ['hidden','visible'][+(C1 !== undefined)];
        //         // console.log(C1);
        //         C1 && a_path.setPathData(C1.svg);


        //         C1 = N.convert(part_mirror, b2, b);
        //         N.bez.set(C1.raw);
        //         N.bez.exts().map((e,i)=>{
        //             if(i === 0 && e[0]) p2 = e[0];
        //             const rand = N.dom.querySelectorAll(`.randy`)[randies];
        //             if(e[0]){
        //                 setAttrs(rand,{
        //                     visibility: "visible",
        //                     fill: i === 0 ? 'red' : 'green',
        //                     r: i === 0 ? 6 : 3,
        //                     cx:e[0].x,
        //                     cy:e[0].y
        //                 })
        //                 randies++;
        //             }
        //         });
        //         b_path.style.visibility = ['hidden','visible'][+(C1 !== undefined)];
        //         // console.log(C1);
        //         C1 && b_path.setPathData(C1.svg);

        //         if(p1 && p2){
        //             // console.log(p1,p2);
        //             const line = N.dom.querySelectorAll(`.con_line`)[randies];

        //             let a = new Vector(p1);
        //             let b = new Vector(p2);
        //             let o = a.subtract(b).scale(-0.2);
                    
        //             let a2 = a.subtract(o);
        //             let b2 = b.add(o);


        //             setAttrs(line,{
        //                 visibility: "visible",
        //                 x1:a2.x,
        //                 y1:a2.y,
        //                 x2:b2.x,
        //                 y2:b2.y
        //             })


        //             randies++;
        //         }


        //     }

            // const s = part._path_data[a];
            // const s2 = part._path_data[a2];

            // if(s && s2){    
            //     if(s.values.length > 2){
            //         C1.push(s.values[4],s.values[5]);
            //     }else{
            //         C1.push(s.values[0],s.values[1]);
            //     }
            //     C1.push(...s2.values);
            // }


            // const t = part_mirror._path_data[b2];
            // const t2 = part_mirror._path_data[b];
            // if(t && t2){    
            //     if(t.values.length > 2){
            //         C2.push(t.values[4],t.values[5]);
            //     }else{
            //         C2.push(t.values[0],t.values[1]);
            //     }
            //     C2.push(...t2.values);
            // }


            // if(r === 0){
            //     ///[...part._pos]
            //     if(C1.length === 8){
            //         C1 = [
            //             {type:'M', values:[C1[0],C1[1]]},
            //             {type:'C', values:C1.slice(2)}
            //         ]
            //         const m_path = N.dom.querySelectorAll(`.chk_path`)[r];
            //         m_path.setPathData(C1);
            //     }

            //     if(C2.length === 8){
            //         C2 = [
            //             {type:'M', values:[C2[0],C2[1]]},
            //             {type:'C', values:C2.slice(2)}
            //         ]

            //         const m_path = N.dom.querySelectorAll(`.chk_path`)[r + L];
            //         m_path.setPathData(C2);

            //     }
            // }
            // [a,a2].map((i) => {
            //     const s = part._path_data[i];
            //     C1.push(s.values.length > 2 ?...s.values) //last 2 terms
            // });

            // [b2,b].map((i) => {
            //     const s = part._path_data[i];
            //     C2.push(...s.values) //last 2 terms
            // });


            // C1 = [
            //     {type:'M', values:part._path_data[r]},
            //     {type:'C', values:a_pos.flat()}
            // ]

            // console.log(C1);
            // console.log(C2);
        // }


    },
    update(point_array){
        // console.log(point_array); //skip Z...
        // const L = point_array.length - 2;
        // let a, b, a2, b2;
        // for(let r = 0; r < L/2; r++){
        //     a = r;
        //     a2 = r + 1
        //     b = L - r;
        //     b2 = b - 1;
        //     console.log(a, a2 ,b, b2);
        //     [a,a2,b,b2].map((i) => {
        //         const {point_index, pid, type, pos, a_pos, pat, ppd } = point_array[i];
        //         // console.log(type, pos);
        //     });
        // }


        // return;

        for(let P of point_array){
            const {point_index, pid, type, pos, a_pos, pat, ppd } = P;
            // console.log(a_pos);
            const p = N.dom.querySelector(`g#connect-${point_index}`);
            const [x,y] = type === 'Z' ? point_array[point_index-1].pos : pos;

            // if(type === 'C' && (ppd === 1 || ppd === 9)){
            //     // pat._control_points && console.log(pat._control_points.get(point_index));
            //     //che4ck against
            //     const nem = [
            //         {type:'M', values:point_array[point_index-1].pos.slice(0,2)},
            //         {type:'C', values:a_pos.flat()}
            //     ]




            //     const m_path = N.dom.querySelectorAll(`.chk_path`)[point_index];
            //     const m_path_box = N.dom.querySelectorAll(`.chk_rect`)[point_index];
            //     m_path.setPathData(nem);

            //     // console.log(pat);

            //     const r = m_path.getBBox();
            //     setAttrs(m_path_box,{
            //         x:r.x,
            //         y:r.y,
            //         width: r.width,
            //         height: r.height,
            //     });


            //     // console.log(nem);
            // }

            if(p){
                let ost = -8;
                if(type === 'Z') ost += 20;
                if(type === 'M') ost += -20;

                const tx = p.querySelector(`text`);
                setAttrs(tx,{x:0,y:ost});
                tx.innerHTML = `${type}${ppd}`;//.${point_index}`;

                p.style.visibility = 'visible';
                setAttrs(p,{transform:`translate(${x}, ${y})`});
            }

        }
    },
    init(){
        N.dom = document.querySelector(`g#overlay-mini`);
        N.dom.style.pointerEvents = 'none';

        N.dom.innerHTML = `
        <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="4" 
            refX="2" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="context-fill"/>
            </marker>
        </defs>`

        N.bounds = createSVGElement("rect", {}, "rect");
        setAttrs(N.bounds,{id:'helper_rect', 'stroke-width':'1', stroke:'red', fill:'none'});
        N.dom.appendChild(N.tester);
        N.dom.appendChild(N.bounds);

        const arr = N.dom.querySelector(`#arrowhead`);
        setAttrs(arr, {fill:"red", transform:"scale(0.01)"});
        
        for(let n=0;n<100;n++){
            const b_rect = createSVGElement("rect", {'stroke-width':'1', stroke:'red', fill:'none'}, "chk_rect");
            const b_path = createSVGElement("path", {'stroke-width':'4', "marker-end": "url(#arrowhead)", stroke:'red', fill:'none'}, "chk_path");
            const c_line = createSVGElement("line", {'stroke-width':'1', stroke:'green', fill:'none'}, "con_line");
            const ran = createSVGElement('circle', {fill:dark_colors ? 'white' : 'blue', "fill-opacity":0.6, cx: 0, cy: 0, r: 6.0}, 'randy');

            N.dom.appendChild(b_rect);
            N.dom.appendChild(b_path);
            N.dom.appendChild(ran);
            N.dom.appendChild(c_line);
        }

        for(let n=0;n<100;n++){
            const connect = createSVGElement("g", {id:`connect-${n}`});
            const ci = createSVGElement('circle', {fill:dark_colors ? 'white' : 'black', cx: 0, cy: 0, r: 3.0});
            const tx = createSVGElement('text');
            setAttrs(tx,{
                fill: dark_colors ? 'white' : 'black',
                'font-size':'8pt',
                'dominant-baseline': 'middle',
                'text-anchor': 'middle',
                y:-10
            });
            tx.innerHTML = `P${n}`;
        
            connect.appendChild(ci);
            connect.appendChild(tx);
            N.dom.appendChild(connect);
            connect.style.visibility = 'hidden';
            // console.log(connect);
        }
        
        return N;
    }
}

const M = {
    dom: undefined,
    paths: [],
    helpers: [],
    dom_paths: [],
    original_indices: [],
    original_paths: [],
    mapped_paths: [],
    raw_values: [],
    point_ref_index: 0,
    s: 100.0,
    get_bounds(raw_coords){
        let x_min, x_max, y_min, y_max;
        let xx = [], yy = [];
        const r = raw_coords;

        for(let j=0; j < r.length/2; j++ ){
            const [x,y] = [r[j*2], r[j*2+1]];
            x && xx.push(x);
            y && yy.push(y);
        }

        x_min = Math.min(...xx);
        x_max = Math.max(...xx);
        y_min = Math.min(...yy);
        y_max = Math.max(...yy);

        return {x_min, x_max, y_min, y_max}
    },
    plot_point(dict){
        const [x,y] = [dict.points.cx, dict.points.cy];
        if(x && y){
            const q_sel = M.dom.querySelector(`#m-connect-${dict.index}`);
            setAttrs(q_sel, {'transform':`translate(${x},${y})`});
            const q_tx = q_sel.querySelector(`text`);
            q_tx.innerHTML = `${dict.r_index}${dict.type}`;
            dict.index === 0 && setAttrs(q_tx,{y:-20});
            const q_ci = q_sel.querySelector(`circle`);
            setAttrs(q_ci,{fill: dict.limit ? 'green' : 'magenta'});
            // if(dict.lines){
            //     const q_li = q_sel.querySelector(`line`);
            //     setAttrs(q_li, {
            //         x1:dict.lines.x1,
            //         x2:dict.lines.x2,
            //         y1:dict.lines.y1,
            //         y2:dict.lines.y2,
            //     });
            // }
            q_sel.style.visibility = 'visible';
        }
    },
    plot_line(index, res){
        const q_sel = M.dom.querySelectorAll(`path.chief`)[index];
        const cip = M.dom.querySelectorAll(`circle.cip`);
        const r = M.raw_values[index];
        
        vec2.copy(ve,[res.points[0].cx, res.points[0].cy]);

        const reversed = ve[1] > r[1];
        const ost = reversed ? 1-res.dist : res.dist;

        if(reversed){
            va.set([r[6],r[7]]);
            vb.set([r[4],r[5]]);
            vc.set([r[2],r[3]]);
            vd.set([r[0],r[1]]);
        }else{
            va.set([r[0],r[1]]);
            vb.set([r[2],r[3]]);
            vc.set([r[4],r[5]]);
            vd.set([r[6],r[7]]);
        }

        vb2.set(vb);

        // setAttrs(cip[1], {'cx':vb[0], 'cy':vb[1]});
        // setAttrs(cip[2], {'cx':vc[0], 'cy':vc[1]});

        vb.sub(va).mul(ost).add(va);

        // setAttrs(cip[3], {'cx':vb[0], 'cy':vb[1]});

        vc.sub(vb2).mul(ost).add(vb2);
        
        // setAttrs(cip[0], {'cx':vc[0], 'cy':vc[1]});

        vc.sub(vb).mul(ost).add(vb);

        // setAttrs(cip[4], {'cx':vc[0], 'cy':vc[1]});

        const body = [
            {type:'M', values:va},
            {type:'C', values:[vb,vc,ve].flat()},
        ]

        q_sel.setPathData(body);
        setAttrs(q_sel, {'stroke': reversed ? 'blue' : 'green'});
        


        q_sel.style.visibility = 'visible';

    },

    post_process(index){
        const r = M.raw_values[index];
        const {x_min, x_max, y_min, y_max} = M.get_bounds(r);
        const [x,y] = [r[0],r[1]];      

        const dict = {
            points:{cx:x, cy:y},
            // lines:undefined,
            type: 'M',
            index: M.point_ref_index,
            r_index: M.original_indices[index],
            limit: x == x_min || x == x_max || y == y_min || y == y_max 
        }
        
        M.plot_point(dict);
        M.point_ref_index++;

        const init_box =  M.dom_paths[index].getBBox();

        let ri = 0;
        get_c_params(r, init_box).map((res,r_i) => {
            if(res){
                const [x,y] = [res.points.cx, res.points.cy];
                dict.points = res.points[0];
                // dict.lines = res.lines[0];
                dict.type = 'GG';
                dict.index = M.point_ref_index;
                dict.r_index = M.original_indices[index]+'ctrl',
                dict.limit = x == x_min || x == x_max || y == y_min || y == y_max;
                M.plot_point(dict);
                M.plot_line(index, res);
                M.point_ref_index ++;
                ri++;
            }
        });

    },
    init(){
        M.dom = document.querySelector(`g#overlay`);
        setAttrs(M.dom, {transform:`translate(${width/4},${height/2})`});

        for(let n=0;n<20;n++){
            const connect = createSVGElement("g", {id:`m-connect-${n}`}, 'kerf');

            const ci = createSVGElement('circle', {cx: 0, cy: 0, r: 6.0, fill:'magenta'});
            const fi = createSVGElement('path', {d:'', stroke:'orange','stroke-width':8});
            const li = createSVGElement('line', {x1: 0, x2: 0, y1: 0, y2: 0, stroke:'magenta','stroke-width':4});
            const tx = createSVGElement('text');

            setAttrs(tx,{
                fill: 'white',
                'font-size':'16pt',
                'dominant-baseline': 'middle',
                'text-anchor': 'middle',
                y:-10
            });      

            connect.appendChild(ci);
            connect.appendChild(li);
            connect.appendChild(fi);
            connect.appendChild(tx);
            M.dom.appendChild(connect);
        }


       return M;
    },
    //this is the caller ƒ
    update_overlay(proj){
        M.point_ref_index = 0;
        const de = document.querySelectorAll(`g.kerf`);
        de.forEach((d) => d.style.visibility = 'hidden');
        
        const le = document.querySelectorAll(`path.chief`);
        le.forEach((d) => d.style.visibility = 'hidden');

        const a = proj.z_rotation;

        for(let i=0; i< M.paths.length; i++){
            const orp = M.original_paths[i];
            const nep = M.paths[i];
            const raw = [];

            for(let n=0; n<orp.length; n++){
                const p = orp[n];
                for(let j=0; j<p.values.length/2; j++){
                    const [x,y] = [p.values[j*2], p.values[j*2+1]];
                    const nx = x*Math.cos(a) - y*Math.sin(a);
                    const ny = y*Math.cos(a) + x*Math.sin(a);
                    nep[n].values[j*2] = nx;
                    nep[n].values[j*2+1] = ny;
                    raw.push(nx,ny);
                }
            }

            M.raw_values[i] = raw;

            M.post_process(i);

            M.dom_paths[i].setPathData(nep);

            const r = M.dom_paths[i].getBBox();

            const helper = M.helpers[i];

            setAttrs(helper,{
                x:r.x,
                y:r.y,
                width: r.width,
                height: r.height,
            });

            
        }
    },
    add_to_overlay(path_data){
        transform_svg_data(path_data, {t:0.0, s:M.s});

        path_data.map((p,j) => {
            if(p.type === 'C'){
                M.original_indices.push(j);






                const helper_rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                setAttrs(helper_rect,{id:'helper_rect', 'stroke-width':'1', stroke:'red', fill:'none'});
                M.helpers.push(helper_rect);
                M.dom.appendChild(helper_rect);


                const anchor = path_data[j-1].type === 'C' ? path_data[j-1].values.slice(4) : path_data[j-1].values;
                const pd = [
                    {type:'M', values:anchor},
                    {type:'C', values:p.values}
                ]

                M.raw_values.push([anchor,p.values].flat());
                
                const pi = createSVGElement('path', {'stroke':'white', 'fill':'none', 'data-ref':j});
                const opi = createSVGElement('path', {'stroke':'blue', 'fill':'none', 'data-ref':j});
                const popi = createSVGElement('path', {'stroke':'black','stroke-width':'1', 'stroke-opacity':'1', 'fill':'none', 'data-ref':j}, 'chief');
                // const popi = createSVGElement('path', {'stroke':'orange','stroke-width':'12', 'stroke-opacity':'0.75', 'fill':'none', 'data-ref':j}, 'chief');
                pi.setPathData(pd);
                opi.setPathData(pd);
                popi.setPathData(pd);

                const cip = createSVGElement('circle', {cx: 0, cy: 0, r: 5.0, fill:'magenta'}, 'cip');
                const cip1 = createSVGElement('circle', {cx: 0, cy: 0, r: 3.0, fill:'magenta'}, 'cip');
                const cip2 = createSVGElement('circle', {cx: 0, cy: 0, r: 3.0, fill:'magenta'}, 'cip');
                const cip3 = createSVGElement('circle', {cx: 0, cy: 0, r: 2.0, fill:'pink'}, 'cip');
                const cip4 = createSVGElement('circle', {cx: 0, cy: 0, r: 2.0, fill:'pink'}, 'cip');

                M.dom_paths.push(pi);
                
                M.dom.appendChild(opi);
                
                M.dom.appendChild(pi);
                M.dom.appendChild(popi);

                M.dom.appendChild(cip);
                M.dom.appendChild(cip1);
                M.dom.appendChild(cip2);
                M.dom.appendChild(cip3);
                M.dom.appendChild(cip4);

                M.paths.push(pi.getPathData());
                M.original_paths.push(pi.getPathData());
            }
        });

        // alert(M.original_indices);
    },
    desired_effect(list_of_c){
        // or is desired effect is as-applied to record point?
        // straight to get_c_params from point descrbed? 
    }

}













export { M as manager, N as miniManager }