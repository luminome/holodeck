import { vec2, vec3, mat4 } from "gl-matrix";
import { reverse } from "svg-path-reverse";
import { init_bez, get_params, get_c_params } from "./nerf.js";
import { setAttrs, createSVGElement, resize_svg_paths, transform_svg_data, sortDomByDistance } from "./utils.js";
import { _set_buffer, _get_buffer } from "./projector.js";
import { manager, miniManager } from "./overlay-manager.js";
import { Bezier } from "bezier-js";

import "./path-data-polyfill.js";

const u = vec3.create();
const v = vec3.create();
const w = vec3.create();

const n = vec3.create();
const a = vec3.create();
const b = vec3.create();

function log(){
  console.log([...arguments]);
}

// 📌 primitive function;
function get_normal(pv){
  [u,v,w].map((vc,i) => vec3.copy(vc, vec3.fromValues(pv[i][0],pv[i][1],pv[i][2])));
  ///console.log(u,v,w);

  vec3.sub(a,v,u);
  vec3.sub(b,w,u);
  vec3.cross(n,a,b);

  return n;
}

// 📌 primitive function;
function get_pos(pv){
  let ax = 0, ay = 0, az = 0;
  
  for(let p of pv){
    ax += p[0];
    ay += p[1];
    az += p[2];
  }

  vec3.set(n,ax/pv.length, ay/pv.length, az/pv.length);//az/pv.length)
  //vec3.scale(n,n,1/pv.length);
  // [u,v,w].map((vc,i) => vec3.copy(vc, vec3.fromValues(pv[i][0],pv[i][1],pv[i][2])));
  // ///console.log(u,v,w);

  // vec3.sub(a,v,u);
  // vec3.sub(b,w,u);
  // vec3.cross(n,a,b);

  return n;
}

// 📌 primitive next function;
function add_path_to_buffer(path_data, butter, position, z_offset ){
  const pat_map = new Map();
  
  for(let i=0; i<path_data.length; i++){
    pat_map.set(i,[path_data[i].type]);
    for(let j=0; j<path_data[i].values.length/2; j++){
      _set_buffer(butter, position, [...path_data[i].values.slice(j*2,j*2+2),z_offset]);
      pat_map.get(i).push(position);
      position++;
    }
  }
  return [position, pat_map];
}

// 📌 primitive next function;
function set_path_from_buffer(path_data, butter, indices, position ){
  for(let i=0; i<path_data.length; i++){
    for(let j=0; j<path_data[i].values.length/2; j++){
      const buf = _get_buffer(butter, indices[position]);
      // if(buf[2] < 0) return 'oob';
      path_data[i].values[j*2] = buf[0];
      path_data[i].values[j*2+1] = buf[1];
      position++;
    }
  }
}

// 📌 primitive type;
const g_face_path = (index) => {

    const F = {
      _path: document.createElementNS("http://www.w3.org/2000/svg", "path"),
      _path_copy: undefined,
      _path_data: undefined,
      _path_data_og: undefined,
      _normal: vec3.create(),
      _pos: vec3.create(),
      _trans_normal: vec3.create(),
      _no_normal:false,
      _points: [],
      _buffer_data: {},
      index: index,
      dist: undefined,
      init(d_path_data, has_clone){
        F._path_copy = has_clone;
        const set_from_data = Array.isArray(d_path_data);
        setAttrs(F._path,{
          'd':set_from_data ? '' : d_path_data,
        });
        if(set_from_data){  
          F._path.setPathData(d_path_data);
          F._path_data = d_path_data;
        }else{
          F._path_data = [...F._path.getPathData()];
        }
        F.set_style();
        return F;
      },
      set_normal(z=0.0){
        // const k_org = F._path_copy.getPathData();
        // // console.log(F._path_copy.getPathData()[0].values);
        // k_org.map((pef,j) => {
        //   const real_point = pef.type === 'C' ? pef.values.slice(4,6) : pef.values.slice(0,2);
        //   if(pef.type !== 'Z'){
        //     const [x,y] = real_point;
        //     F._points.push(vec3.fromValues(x,y,z));
        //   }
        // });
        // console.log(F._points);
        // vec3.normalize(F._normal, get_normal(F._points));
        // vec3.negate(F._normal,F._normal);
      },
      set_style(styles = {'fill':'gray', 'stroke':'black', 'stroke-width': 1.0, 'fill-opacity':0.5}){
        setAttrs(F._path,{
          'fill':styles.fill,
          'stroke':styles.stroke,
          'stroke-width':styles['stroke-width'],
          'fill-opacity':styles['fill-opacity']
        });
      },
      set_index_offset(i){
        F.index = i;
        setAttrs(F._path,{'data-index':i});
      },
      transform(t=0.0,s=1){
        for(let i=0; i<F._path_data.length; i++){
          for(let j=0; j<F._path_data[i].values.length; j++){
            F._path_data[i].values[j] += t;
            F._path_data[i].values[j] *= s;
          }
        }
        F._path.setPathData(F._path_data);
      },
      set_path(d){
        F.dist = d;
        F._path.setPathData(F._path_data);
      }
    }

    return F;
}

// 📌 non_primitive object group;
const all_models = {
  cube(){
    const [cw,ch,cd] = [10,10,10];
  
    const verts = new Float32Array([
      -cw,ch,cd,
      cw,ch,cd,
      cw,-ch,cd,
      -cw,-ch,cd,
      -cw,ch,-cd,
      -cw,-ch,-cd,
      cw,-ch,-cd,
      cw,ch,-cd
    ]);
  
    const indices = new Uint16Array([
      0,1,2,3,
      2,1,7,6,
      1,0,4,7,
      0,3,5,4,
      3,2,6,5,
      4,5,6,7
    ]);

    const path_objects = new Map();
    const pt_length = 4;

    for(let p=0; p<indices.length/pt_length; p++){
      // log('created-cube-face', p);    
      const pat_map = new Map();
  
        

      const pat = g_face_path(p);
      const ste = indices.slice(p*pt_length, p*pt_length+pt_length);
      let d = '';
      for(let i=0; i<ste.length; i++){
        const [x,y,z] = _get_buffer(verts, ste[i]);
        const type = i === 0 ? 'M' : 'L';
        d += type;
        d += `${x} ${y} `;

        type !== 'M' && pat._points.push(vec3.fromValues(x,-y,z));
        
        const id = `${type}`;
        pat_map.set(i,[type, ste[i]]);
      }
      d += 'Z';
      const id = `Z${ste.length}`;
      pat_map.set(ste.length,['Z']);

      vec3.normalize(pat._normal, get_normal(pat._points));
      vec3.negate(pat._normal, pat._normal);

      vec3.copy(pat._pos, get_pos(pat._points));
      pat._buffer_data.start = p*pt_length;
      pat._buffer_data.stop = p*pt_length + pt_length;
      pat._buffer_data.map = pat_map;
      pat._buffer_data.indices = [...pat._buffer_data.map.values()].flat();
      console.log('cube-identifier', [...pat._pos]);
      path_objects.set(p, pat.init(d));
      
    }

    return {buffer:verts, indices, path_objects, len:8}
  },
  special(parts_obj, identifier = undefined){
    //⭐⭐ ULTIMATELY GORGEAOUS; 
    //⭐⭐ REALLY FUXING INCREDIBLE.;
    
    let buf_length = 0;
    const path_objects = new Map();
    const parts = parts_obj.parts['data'];
    const buffer_temp = new Float32Array(1000); /// max values for C type;
    const indices_temp = new Float32Array(1000); /// max values for C type;
    // for(let i=0; i<indices_temp.length; i++) indices_temp[i] = i;

    let start_index = 0;
    let meta_index = 0;
    let part_index = 0;

    const make_part_secondary = (part_data_sec, indices, point_indices) => {
      console.log('make_part_secondary');
      // console.log(part_index, path_objects);
      // console.log(index_position, indices);

      // console.log(meta_index, part_data_sec, point_indices, indices);

      const pat = g_face_path(part_index).init(part_data_sec);

      if(parts_obj.no_normal) pat._no_normal = true;

      pat._buffer_data.start = meta_index;
      pat._buffer_data.indices = indices;

      for(let p=0; p<indices.length; p++){
        indices_temp[meta_index] = indices[p];
        meta_index++;
      }

      point_indices.map((inx,j) => {

        if(part_data_sec[j].type !== 'Z' && part_data_sec[j].type !== 'M'){

          let [x,y,z] = _get_buffer(buffer_temp, inx);
          pat._points.push(vec3.fromValues(x,-y,z));

        }
      });

      vec3.normalize(pat._normal, get_normal(pat._points));
      vec3.copy(pat._pos, get_pos(pat._points));

      console.log('sec pat._pos',[...pat._pos],'sec pat._norm',[...pat._normal]);

      path_objects.set(part_index, pat);
      part_index++;
    }

    
    const make_part = (part, extrude) => {
      console.log('make_part');

      const z_offset = extrude ? extrude : 0.0; 
      const part_data = part.getPathData();
      const part_data_og = part.getPathData();

      if(parts_obj.transform) transform_svg_data(part_data, parts_obj.transform);
      if(parts_obj.transform) transform_svg_data(part_data_og, parts_obj.transform);

      const pat = g_face_path(part_index).init(part_data, part);
      pat._path_data_og = part_data_og;

      if(parts_obj.no_normal) pat._no_normal = true;
      if(parts_obj.has_marker) pat.has_marker = true;
      pat.id = part.id;
      pat._mirror = null;

      const repa = add_path_to_buffer(pat._path_data, buffer_temp, start_index, z_offset);
      pat._buffer_data.start = meta_index;

      console.log(start_index,repa[0],repa[1]);

      for(let p=start_index; p<repa[0];p++){
        indices_temp[meta_index] = p;
        meta_index++;
      }
      start_index = repa[0];

      pat._buffer_data.map = repa[1];
      pat._buffer_data.indices = [...pat._buffer_data.map.values()].flat();


      console.log(pat._buffer_data);


      if(pat._buffer_data.indices.indexOf('C') !== -1){
        pat._control_points = new Map();
      }

      let lkct = 0;
      // let blank_coords = 
      pat._buffer_data.map.forEach((p,j)=>{
        if(p[0] !== 'Z' && p[0] !== 'M'){

          const [x,y,z] = _get_buffer(buffer_temp, indices_temp[pat._buffer_data.start+lkct]);
          pat._points.push(vec3.fromValues(x,-y,z));

          if(p[0] === 'C'){
            pat._control_points.set(p[3],{
              index:j,
              coords:[0,0,0,0,0,0,0,0,0,0,0,0], //will need to be 2d "C".
              bez: new Bezier(new Float32Array(12)),//;//init_bez()
              bez_og: new Bezier(new Float32Array(8)),//;//init_bez()
            });
            lkct += 2;
          }

        }
        lkct += 1;
      });


      vec3.normalize(pat._normal, get_normal(pat._points));
      vec3.copy(pat._pos, get_pos(pat._points));
      console.log('pat._pos',[...pat._pos],'pat._norm',[...pat._normal]);

      console.log(indices_temp);
      
      path_objects.set(part_index, pat);

      const ret = [part_index, pat];

      part_index++;
      return ret;
    }

    for(let part of parts){
      if(part.id.indexOf('bounds') !== -1) continue;

      const [master_index, master_part] = make_part(part, parts_obj.extruded);
      part.style['fill-opacity'] = '0.5 !important;';
      
      master_part.set_style(part.style);

      setAttrs(master_part._path,{'fill-opacity':0.5});

      if(parts_obj.extruded){
        const m_part = part.cloneNode(true);
        careful_path_extrusion(m_part, parts_obj.extruded);
        const [mirror_index, mirror_part] = make_part(m_part, -parts_obj.extruded);
        mirror_part.set_style(part.style);
        master_part._mirror = mirror_index;

        if(parts_obj.show_extruded_planes){
          const point_len = master_part._path_data.length-1;
          let a, b, a2, b2, inv;

          for(let i=0;i<point_len;i++){                    
            a = i;
            a2 = i-1 < 0 ? point_len-1: i-1;
            inv = Math.abs((i-(point_len)))-1;
            b = inv+1 === point_len ? 0 : inv+1;
            b2 = inv;

            // console.log(a, a2, b, b2);
            if(a === 0 && a === b && a2 === b2) continue;

            let adv = '';
            const res = [];

            const dummy_path_data = [
              {type:'M', values:[0,0]},
              {type:'L', values:[0,0]},
              {type:'L', values:[0,0]},
              {type:'L', values:[0,0]},
              {type:'Z', values:[]}
            ]
            const point_indices = [];

            const indices = [a, a2, b, b2].map((n, j) => {

                const part = j > 1 ? mirror_part : master_part;
                const map_part = part._buffer_data.map.get(n);

                
                adv += map_part[0]+' ';

                if(map_part[0] === 'C'){
                  point_indices.push(map_part[3]);

                  if(j === 0 || j === 2){
                    dummy_path_data[j+1].type = 'C';
                    dummy_path_data[j+1].values = [0,0,0,0,0,0];
                    return [map_part[3], map_part[2], map_part[1]];
                  }

                  return map_part[3];
                }else{
                  point_indices.push(map_part[1]);
                  return map_part[1];
                }

            }).flat();
            
            make_part_secondary(dummy_path_data, indices, point_indices);
          }
        } 
      }      
    }

    const buffer = buffer_temp.slice(0, meta_index*3);
    const indices = indices_temp.slice(0, meta_index+1);
    return {buffer, indices, path_objects, len:2, special:parts_obj.special};
  },
  hermit(){
    return;
    const parts = [
      `M 1 0.5 C 1 0.6380710938 0.9440355469 0.7630710938 0.8535535156 0.8535535156 C 0.7630714844 0.9440359375 0.6380710938 1 0.5 1 C 0.3619289062 1 0.2369289063 0.9440355469 0.1464464844 0.8535535156 C 0.0559640625 0.7630714844 0 0.6380710938 0 0.5 C 0 0.3619289062 0.0559644531 0.2369289063 0.1464464844 0.1464464844 C 0.2369285156 0.0559640625 0.3619289063 0 0.5 0 C 0.6380710938 0 0.7630710938 0.0559644531 0.8535535156 0.1464464844 C 0.9440359375 0.2369285156 1 0.3619289063 1 0.5 Z`,
      `M 10 80 Q 52.5 10 95 80 T 180 80 Z`
    ]
    let buf_length = 0;
    const path_objects = [];

    for(let i=0; i<parts.length; i++){
      const pat = g_face_path(i).init(parts[i]);
      pat._path_data.map((d) => buf_length += (d.values.length+(d.values.length/2)));
      console.log(pat, buf_length);
      path_objects.push(pat);
    }

    path_objects[0].transform(-0.5, 100.0);
    
    const buffer = new Float32Array(buf_length*8); /// max values for C type;
    const indices = new Uint16Array(buf_length);
    for(let i=0; i<indices.length; i++) indices[i] = i;
    
    let start_index = 0;
    path_objects.map((pat,i) => {
      pat.buffer_index = start_index;
      start_index = add_path_to_buffer(pat._path_data, buffer, start_index, 8.0);
      pat.end_index = start_index;

      pat._path_data.map((pat_dat,j) => {
        const [x,y,z] = _get_buffer(buffer, pat.buffer_index+j);
        pat._points.push(vec3.fromValues(x,y,z));
      });

      vec3.normalize(pat._normal, get_normal(pat._points));
    })

    return {buffer, indices, path_objects, len:2}
  }
}




const careful_path_extrusion = (part, extrusion) => {
  const kpe = reverse(part.getAttribute('d'));
  setAttrs(part,{d:kpe});
  return part;
}


const point_report = (path_objects_map, screen_buffer) => {
  let point_index = 0;
  let dex = [];
  path_objects_map.forEach((pat,i) => {
    pat._buffer_data.map && pat._buffer_data.map.forEach((pd,j) => {

        const pid = pd[0] === 'C' ? pd[3] : pd[1];
        const m_set = pd.slice(1).map((ind) => _get_buffer(screen_buffer, ind).slice(0,2));
        const [x,y,z] = _get_buffer(screen_buffer, pid);
        dex.push({point_index, pid, type:pd[0], pos:[x,y,z], a_pos:m_set, pat, ppd:j});
        
        
        
        point_index++;
    });
  });
  return dex;
}





// 📌 object type;
const g_gnarly = (projector, identifier,  model = 'cube', index_top = 0) => {
  let parts = undefined;
  if(typeof model === 'object'){   
    parts = model;
    model = 'special';
  }
  const gnar = g_complex(projector);
  gnar.offset_index = index_top*100;
  gnar.name = identifier;
  gnar.init(all_models[model](parts, identifier));
  return gnar;
}



// 📌 object type;
// this object will render literally anything.
const g_complex = (projector) => {

  const t_mat = new Float32Array(16);
  const t_mat_rotate = new Float32Array(16);
  const t_mat_scale = new Float32Array(16);
  const t_mat_id = new Float32Array(16);

  mat4.identity(t_mat_rotate);
  mat4.identity(t_mat_scale);
  mat4.identity(t_mat_id);

  const G = {
    svg: document.createElementNS("http://www.w3.org/2000/svg", "g"),
    util_path: document.createElementNS("http://www.w3.org/2000/svg", "path"),
    base_siz: 1.0,
    loc: vec3.create(),
    u: vec3.create(),
    paths: [],
    order: undefined,
    overlay: undefined,
    mini_overlay: undefined,
    verts_screen: undefined,
    model: undefined,
    special_behaviour: undefined,
    offset_index: 0,
    initialized: false,


    init(model){
      if(!model) return undefined;
      G.verts_screen = new Float32Array(model.buffer.length);
      G.order = new Uint16Array(model.path_objects.size);
      G.model = model;
      G.overlay = G.name === 'cheese' ? manager.init() : undefined;
      G.mini_overlay = G.name === 'cheese' ? miniManager.init() : undefined;

      log('build model', G.name, G.model.special);
      
      G.model.path_objects.forEach((p, i) => {
        // G.name === 'cheese' && G.overlay.add_to_overlay(p._path_data);
        p.set_index_offset(G.offset_index+i);
        G.svg.appendChild(p._path);
      });

      // mat4.rotate(t_mat_rotate, t_mat_rotate, Math.PI/2, [1,0,0]);


      G.svg.appendChild(G.util_path);
      G.initialized = true;
      return G;
    },

    render(proj){
      // return;

      if(!G.initialized) return undefined;
      // mat4.rotate(t_mat_rotate, t_mat_rotate, Math.PI/180, [0,0,1]);

      if(G.model.special){
        const s = vec3.length(projector.world_position)*2;
        mat4.scale(t_mat_scale, t_mat_id, [s,s,s]);
      }
      
      mat4.mul(t_mat, t_mat_rotate, t_mat_scale);

      for(let j=0; j<G.model.buffer.length/3; j++ ){
        vec3.transformMat4(G.u, _get_buffer(G.model.buffer, j), t_mat);
        // vec3.copy(G.u,_get_buffer(G.model.buffer, j));
        // vec3.transformMat4(G.u, _get_buffer(G.model.buffer, j), t_mat);
        const {p,z} = projector.project_sm(G.u);
        _set_buffer(G.verts_screen, j, [p[0], p[1], z]);
      }


      G.mini_overlay.rota = proj.z_rotation;
      G.name === 'cheese' && G.mini_overlay.update(point_report(G.model.path_objects, G.verts_screen));
      const siz = G.model.path_objects.size;

      G.model.path_objects.forEach((pat,i) => {

        vec3.transformMat4(pat._trans_normal, pat._normal, t_mat);
        // vec3.normalize(v, pat._pos);
        vec3.sub(v, projector.camera_world_position, pat._pos);
        // vec3.normalize(u, projector.camera_world_position);



        let norm_ok = pat._no_normal ? true : vec3.dot(pat._trans_normal, v) <= 0;
        // if(norm_ok){
          set_path_from_buffer(pat._path_data, G.verts_screen, G.model.indices, pat._buffer_data.start);
          // set_path_from_buffer(pat._path_data_og, G.model.buffer, G.model.indices, pat._buffer_data.start);

          if(pat._mirror && G.name === 'cheese') G.mini_overlay.re_update(pat, G.model.path_objects.get(pat._mirror));
          // G.name === 'cheese' && G.mini_overlay.re_update(i, siz, pat._path_data);
          // vec3.copy(u, pat._pos);
          vec3.transformMat4(u, pat._pos, t_mat);
          // vec3.copy(u, pat._pos);
          // vec3.copy(u, pat._normal);
          // vec3.copy(u, pat._normal);
          const {d} = projector.project_sm(u);

          pat.set_path(d);
          
        // }
        setAttrs(pat._path,{visibility: norm_ok ? 'visible' : 'hidden'});
        // pat.has_marker && G.post_process(pat,i);
        // pat.has_marker && G.overlay.update_overlay(proj);
        // pat.has_marker && G.mini_overlay.update_overlay(proj);

      })


      // for(let i=0; i<G.model.path_objects.length; i++){
      //   const pat = G.model.path_objects[i];

      //   vec3.transformMat4(pat._trans_normal, pat._normal, t_mat);
      //   let norm_ok = pat._no_normal ? true : vec3.dot(pat._trans_normal, projector.camera_world_position) <= 0;
      //   if(norm_ok){
      //     const stat = set_path_from_buffer(pat._path_data, G.verts_screen, G.model.indices, pat.buffer_index);
      //     if(stat === 'oob'){
      //       norm_ok = false;
      //     }else{
      //       vec3.negate(u, pat._normal);
      //       const {d} = projector.project_sm(u);
      //       pat.set_path(d);
      //     }
      //   }
      //   setAttrs(pat._path,{visibility: norm_ok ? 'visible' : 'hidden'});
        
      // }

      sortDomByDistance(G.svg, G.model.path_objects, G.order);


    },
    
    stat(){

    }
  }


  return G;
}


// 📌 object type;
const g_cube = (projector) => {
  return;
  const [cw,ch,cd] = [1,1,1];
  const t_mat = new Float32Array(16);
  const t_mat_id = new Float32Array(16);
  mat4.identity(t_mat);
  mat4.identity(t_mat_id);

  const verts = new Float32Array([
    -cw,ch,cd,
    cw,ch,cd,
    cw,-ch,cd,
    -cw,-ch,cd,
    -cw,ch,-cd,
    -cw,-ch,-cd,
    cw,-ch,-cd,
    cw,ch,-cd
  ]).map((v) => v *= 4.0);

  const L = 8;
  
  const verts_screen = new Float32Array(24);

  const faces = [
    [0,1,2,3],
    [2,1,7,6],
    [1,0,4,7],
    [0,3,5,4],
    [3,2,6,5],
    [4,5,6,7]
  ];

  const G = {
    svg: document.createElementNS("http://www.w3.org/2000/svg", "g"),
    base_siz: 2.0,
    loc: vec3.create(),
    u: vec3.create(),
    face_paths: [],
    order: undefined,
    init(){
      G.order = new Uint16Array(faces.length);
      for(let i=0; i<faces.length; i++){
        const f = faces[i];
        const vt = f.map((index,j) => _get_buffer(verts,index));
        const f_p = g_face_path(i+1000).init(vt.flat());
        G.svg.appendChild(f_p._path);
        G.face_paths.push(f_p);
      }
      return G;
    },

    render(){
      mat4.rotate(t_mat, t_mat, Math.PI/180, [0,0,1]);

      for(let i=0; i<L; i++){
        vec3.transformMat4(G.u, _get_buffer(verts,i), t_mat);
        const {p,z,d} = projector.project_sm(G.u);
        if(z < 0) return; // don' render, a point is out of bounds
        _set_buffer(verts_screen, i, [p[0], p[1], z]);
      }

      for(let i=0; i<G.face_paths.length; i++){
        const fp = G.face_paths[i];
        vec3.transformMat4(fp._trans_normal, fp._normal, t_mat);
        const norm_ok = vec3.dot(fp._trans_normal, projector.camera_world_position) <= 0;
        if(norm_ok){
          faces[fp.index-1000].map((index,j) => fp._path_data[j].values = _get_buffer(verts_screen,index).slice(0,2));
          vec3.negate(u, fp._normal);
          const {p,z,d} = projector.project_sm(u);
          fp.set_path(d);
        }
        setAttrs(fp._path,{visibility: norm_ok ? 'visible' : 'hidden'});
      }
      sortDomByDistance(G.svg, G.face_paths, G.order);
    },
    
    stat(){

    }
  }


  return G;
}


// 📌 object type;
const g_square_path = (index, projector) => {
    const z = 1.0;
    let failed_to_render = false;
    const verts = new Float32Array([
      -1,1,z,
      1,1,z,
      1,-1,z,
      -1,-1,z
    ]).map((v) => v *= 1.0);
  
    const P = {
      pathdata: undefined,
      name: undefined,
      index: index,
      loc: vec3.create(),
      px_loc: vec2.create(),
      z_index: undefined,
      base_siz: 8.0,
      base_color: 'yellowgreen',
      track: undefined,

      cancel_update(){
        P.svg.visibility = 'hidden';
        console.log('out');
        return;
      },

      setDefault(){
        // no projection here
        const c = ['a','b','c','d'].map((s,i) => { return {p:_get_buffer(verts,i).slice(0,2)} });
        const d = `M${c[0]['p']} L${c[1]['p']} L${c[2]['p']} L${c[3]['p']}z`;

        vec3.normalize(n,get_normal(verts));
        console.log([...n]);
        setAttrs(P.svg_item,{d:d});
      },

      update(){
        const c = ['a','b','c','d'].map((s,i) => projector.project_sm(_get_buffer(verts,i)));
        const d = `M${c[0]['p']} L${c[1]['p']} L${c[2]['p']} L${c[3]['p']}z`;
        setAttrs(P.svg_item,{d:d});
      },
  
      make_path_svg(){
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        setAttrs(g,{
          'data-index': P.index,
        });
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        setAttrs(p,{
          'fill-opacity': '0.5',
        });
        return [g, p];
      },
    
      init(){
        [P.svg, P.svg_item] = P.make_path_svg();
        // P.update();
        P.setDefault();
        P.pathdata = P.svg_item.getPathData();
        

        console.log(P.pathdata);

        P.svg.appendChild(P.svg_item);




        return P;
      },
  
    }
  
    return P;
  }
  
  // 📌 object type;
  const g_point = (index) => {
  
    const make_point_svg = () => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      setAttrs(g,{
        'id': `grid-${P.index.toString().padStart(2,'0')}`,
        'data-index': P.index
      });
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      setAttrs(t,{
        fill: 'black',
        'dominant-baseline': 'middle',
        'text-anchor': 'middle'
      });
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      return [g, c, t];
    }
  
    const init = () => {
      [P.svg, P.svg_item, P.svg_text] = make_point_svg();
      P.svg.appendChild(P.svg_item);
      P.svg.appendChild(P.svg_text);
      return P;
    }
  
    const P = {
      name: undefined,
      type: 'point',
      index: index,
      loc: vec3.create(),
      px_loc: vec2.create(),
      z_index: undefined,
      base_siz: 8.0,
      base_color: 'white',
      init
    }
  
    return P;
  }
  
  export { g_point, g_gnarly, g_square_path, g_cube, resize_svg_paths}