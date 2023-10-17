import './style.css'
import { event } from "ts-modules-vite/build/modules/events-massive/event-handler";
import { vec3 } from "gl-matrix";
import { projector, _set_buffer, _get_buffer } from "./projector.js";
import { mover } from "./mover.js"
import { g_point, g_gnarly } from "./model-objects.js";
import { createSVGElement, load_svg_icons, resize_svg_paths, setAttrs, sortDomByDistance } from "./utils.js"

const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;

const dark_colors = window.matchMedia("(prefers-color-scheme: light)").matches;
console.log('dark_colors', dark_colors);


let STOPPED_EXEC = false;
let DEPTH_ENABLE = true;
let LOOP_STYLE = true;

const toggled = {
  Space: STOPPED_EXEC,
  Tab: DEPTH_ENABLE,
  Digit1: LOOP_STYLE,
}

let toggle_check = Object.keys(toggled);

// 📌 make app body-html:
document.querySelector('#app').innerHTML = `

<svg id="environment" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id='f2' x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="24" flood-color="blue" flood-opacity="0.75"/>
    </filter>

    <filter id="fwe2">
      <feGaussianBlur stdDeviation="11 0" />
    </filter>

    <filter id="fs2" x="0" y="0" width="300%" height="300%">
      <feOffset result="offOut" in="SourceGraphic" dx="0" dy="0" />
      <feColorMatrix result="matrixOut" in="offOut" type="matrix"
      values="0.9 0 0 0 0 0 0.9 0 0 0 0 0 0.9 0 0 0 0 0 1 0" />
      <feGaussianBlur result="blurOut" in="offOut" stdDeviation="30" />
      <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
    </filter>
  </defs>

  <clipPath id="myClip">
    <!--
      Everything outside the circle will be
      clipped and therefore invisible.
    -->
    <rect x="0" y="0" width="${width}" height="${height}"/>
  </clipPath>

  <g id="zones">
    <circle id="superlative" cx="0" cy="0" r="22" fill="gray" style="opacity:0.75;"/>
  <g>
  <g id="model" clip-path="url(#myClip)">

  <g>
</svg>

<svg id="autonomous_info_region" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">

</svg>

<div id="output"></div>
<div id="refresh-button">
  <a href="/">
    <svg width="48" height="48" class="icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <circle id="svg_origin" cx="24" cy="24" r="22" fill="gray" style="opacity:0.75;"/>
      <g id="refresh-icon">

      </g>
    </svg>
  </a>
</div>
`

// 📌 setup graphics:
const icon_loader = document.createElement("div");


const environment = document.querySelector('#environment');
const info_svg = document.querySelector('#autonomous_info_region');
const superlative = document.querySelector('#superlative');
const model = document.querySelector('#model');
const output = document.querySelector('#output');
const zones = document.querySelector('#zones');

const uv = vec3.create();
const marker_position = vec3.create();
const proj = projector();

// const helper = document.createElementNS("http://www.w3.org/2000/svg", "g");
// const helper_rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
// setAttrs(helper_rect,{id:'helper_rect',stroke:'red', fill:'none'});
// helper.appendChild(helper_rect);

const overlay = createSVGElement("g", {id:`overlay`});
const overlay_mini = createSVGElement("g", {id:`overlay-mini`});
// setAttrs(overlay,{transform:`translate(200,100) scale(1.0)`});
// const li1 = createSVGElement('line', {x1: -10, x2: 10, y1: 0, y2: 0, stroke:'white'});
// const li2 = createSVGElement('line', {x1: 0, x2: 0, y1: -10, y2: 10, stroke:'white'});
// overlay.appendChild(li1);
// overlay.appendChild(li2);






model.appendChild(overlay_mini);
model.appendChild(overlay);
// model.appendChild(helper);

// 📌 setupevent callback "cb_radio":
const cb_radio = (event, args) => {
  // console.log(event);

  if(Array.isArray(args)){
    args.forEach((v) => (toggle_check.includes(v)) ? toggled[v] = !toggled[v] : void(0));
    if(STOPPED_EXEC !== toggled.Space){
      STOPPED_EXEC = toggled.Space;
      STOPPED_EXEC && console.log('STOPPED_EXECution');
    }

    if(DEPTH_ENABLE !== toggled.Tab){
      DEPTH_ENABLE = toggled.Tab;
      console.log('DEPTH_ENABLE', DEPTH_ENABLE);
    }

    if(LOOP_STYLE !== toggled.Digit1){
      LOOP_STYLE = toggled.Digit1;
      LOOP_STYLE && window.requestAnimationFrame(loop);
      console.log('LOOP_STYLE', LOOP_STYLE);
    }

    if(args.includes('ArrowUp')){
      _ET.offset.y += Math.PI/180; 
    }
  
    if(args.includes('ArrowDown')){
      _ET.offset.y -= Math.PI/180; 
    }

    if(args.includes('ArrowLeft')){
      _ET.offset.x += Math.PI/180; 
    }
  
    if(args.includes('ArrowRight')){
      _ET.offset.x -= Math.PI/180; 
    }

  }

  if(event.target.id && event.target.id === 'environment') info.stash();

  !LOOP_STYLE && loop();

  return true;
}

event(document.body, cb_radio, {'type':'keyboard', 'toggle_keys':toggle_check, 'interval':50});
const _ET = event(environment, cb_radio, {'type':'screen', 'interval':0, 'context_disable':true});




const log = {
  y_deg:0,
  proj_msg:'',
  reordered: 0,
  target: undefined,
  frame: 0,
  pz:0
}

// 📌 set static vars here:
const points = 4;
const spread = 50;
const objects_map = new Map();
const default_cam_distance = 16.0;
const grid_point_size = 10.0;
const grid_point_text = false;
let index = 0;
proj.evt = _ET;
let proto_scale_vertical = 1.0;
let target = undefined;


const projector_messaging = (msg) => log.proj_msg = msg;


const pretty_ass_info_marker = () => {

  const body = () => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    setAttrs(g,{
      'id':'info-marker',
      'class':'info-fadein',
    });
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    setAttrs(t,{
      fill: 'white',
      'dominant-baseline': 'middle',
      'text-anchor': 'middle',
      'font-size':`${I.fontSiz}pt`
    });
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    setAttrs(c,{
      cx: 0,
      cy: 0,
      r: 12.0,
      'stroke': 'white',
      'stroke-width': 4,
      'fill':'none',
      'fill-opacity':0.5
    });

    I.text = t;
    I.svg_item = c;
    I.svg = g;
    g.appendChild(c);
    g.appendChild(t);
    return g;
  }

  const set = (position, rel_size, ref_string=null) => {
    
    if(rel_size < 0) return;
    
    setAttrs(I.svg,{
      transform: `translate(${position[0]} ,${position[1]})`
    });

    setAttrs(superlative,{
      cx:position[0],
      cy:position[1],
      r:(I.siz*rel_size)-2, //4px outline line
      // 'class':'info-fadein',
    });

    setAttrs(I.svg_item,{
      r:I.siz*rel_size
    });

    setAttrs(I.text,{
      y:(I.siz*rel_size)//;//+I.fontSiz
    });

    if(ref_string){
      // text added, not null (updating position only).
      I.element.style.opacity = '1.0';
      superlative.style.opacity = '0.0';

      if(Array.isArray(ref_string)){
        I.text.innerHTML = ref_string.map((rs) => `<tspan x="0" dy="12">${rs}</tspan>`).join('');
      }else{
        I.text.innerHTML = `<tspan x="0" dy="12">${ref_string}</tspan>`;
      }
    }
  }

  const stash = () => {
    I.element.style.opacity = '0.0';
    superlative.style.opacity = '0.0';
  }

  const attach = () => {
    const n_el = body();
    I.element = n_el;
    info_svg.appendChild(n_el);
  }

  const I = {
    siz:60,
    fontSiz:8,
    element: undefined,
    attach,
    stash,
    set
  }

  return I;
}

const info = pretty_ass_info_marker();
info.attach();


const add_point = (name) => {
  const e = g_point(index).init();
  e.name = name;
  e.index = index;
  e.base_siz = 10.0;
  e.base_color = 'white';
  objects_map.set(index,e);
  model.appendChild(e.svg);
  index++;
  return e;
}

//⭐ SETUP GRID POINTS.
for(let x=0;x<points;x++){
  for(let y=0;y<points;y++){
    for(let z=0;z<points;z++){
      const e = add_point('grid');
      vec3.set(e.loc, x*spread, -y*spread, z*spread);
      e.base_color = 'black';
      e.base_siz = grid_point_size;
    }
  }
}

//⭐ SETUP USER.
const user = add_point('user');
user.base_color = 'red';
setAttrs(user.svg,{id:'user-canon','fill-opacity':'0.0'});

//⭐ SETUP CENTER.
const center = add_point('center');
center.base_color = 'white';

//⭐ SETUP POS POINT.
const pos = add_point('pos');
pos.base_color = 'pink';
pos.mover = mover();
setAttrs(pos.svg,{'id':'position'});

// 📌 flag zero:
objects_map.get(0).base_color = 'white';
// objects_map[0].base_color = 'white';

//⭐ SETUP GNAR-CUBE
// const gnar = g_gnarly(proj, 'the-cube', 'cube', index);
// if(gnar){
//   gnar.name = 'the-cube';
//   gnar.index = index;
//   setAttrs(gnar.svg,{'id':`the-cube-base`,'data-index':index});
//   model.appendChild(gnar.svg);
//   // model.appendChild(gnar.util_path);
//   objects_map.set(index, gnar);
//   index++;
// }



let order;


//⭐ LOOP! THIS IS ORIGINAL LUMINOME.
const loop = (frame) => {
  if(!STOPPED_EXEC){
    // fucking incredible.
    log.frame = frame;

    if(pos.mover.is_moving){
      pos.mover.go(frame);
      vec3.copy(proj.destination_pos, pos.mover.pos);
    } 

    proj.update(); //update matrices.

    // 📌 optical 2d distortion brought to you by camera position Z.
    vec3.normalize(uv, proj.camera_position);
    proto_scale_vertical = Math.abs(uv[2]);
    log.y_deg = proto_scale_vertical.toFixed(2);





    // for(let n of objects_map){
    objects_map.forEach((n,i) =>{
      switch(n.name) {
        case 'user':
          vec3.copy(uv, proj.user_world_pos);
          break;
        case 'pos':
          vec3.negate(uv, proj.world_position);
          break;
        case 'grid':
          vec3.add(uv, n.loc, proj.grid_position);
          break;
        default:
          vec3.copy(uv, n.loc);
      }
      
      const {p, z, s, d} = proj.project_sm(uv);

      if(z > 0){
        n.siz = (default_cam_distance / -s);
        n.dist = d;
        n.Z = z;

        n.name === 'plane' && (log.pz = [z,s]);

        if(!isNaN(p[0]) && !isNaN(p[1]) && n.siz < Infinity && n.siz > -Infinity){

          if(n.type === 'point'){
            const s = n.name === 'center' ? proto_scale_vertical : 1.0;
            setAttrs(n.svg_item,{
              'transform': `scale(1,${s})`,
              r: n.siz*n.base_siz > 0 ? (n.siz*n.base_siz).toFixed(2) : 0.0,
              fill: n.base_color
            });

            if(grid_point_text){
              setAttrs(n.svg_text,{'transform': `scale(${n.siz*1.2})`});
              n.svg_text.innerHTML = n.index+'|'+d;
            };
            
            setAttrs(n.svg,{
              'transform': `translate(${p[0]}, ${p[1]})`,
            });
            n.svg.style.opacity = n.siz;
          }else{
            n.render(proj);
          }

          n.svg.visibility = 'visible';
        }else{
          n.svg.visibility = 'hidden';
        }
      }
    });


    let reported = 0;

    if(DEPTH_ENABLE){
      reported = sortDomByDistance(model, objects_map, order);
    }

    log.reordered = DEPTH_ENABLE === true ? reported : 'disabled';

    output.innerHTML = '';
    Object.entries(log).forEach(([k,v]) => output.innerHTML += `<div>${k}</br><b>${v}</b></div>`);
    
    if(target){
      const element = objects_map.get(Number(target.dataset.index));
      const {p} = proj.project_sm(marker_position);
      info.set(p, element.siz);
    }

  }
  LOOP_STYLE && requestAnimationFrame(loop);
}

// https://stackoverflow.com/questions/19764018/controlling-fps-with-requestanimationframe








const setup_and_run = (pk) => {
  icon_loader.innerHTML = pk;

  // 📌 setup graphics attributes as object:
  const parts = {
    '#R':{
      target: 'g#refresh-icon',
      data: undefined,
      scale:48
    },
    '#CHZ':{
      target: undefined,
      data: undefined,
      scale:1.0
    },
    '#CIR':{
      target: undefined,
      data: undefined,
      scale:1.0
    },
    '#PLANE':{
      target: undefined,
      data: undefined,
      scale:1.0
    },
  }

  // 📌 instantiate/copy graphics to object:
  for(let p of Object.keys(parts)){
    const svg_parts = icon_loader.querySelectorAll(`${p}>*`);
    parts[p].data = resize_svg_paths(svg_parts);
    if(parts[p].target){
      const dest = document.querySelector(parts[p].target);
      parts[p].data.forEach((pc) => {dest.innerHTML += pc.outerHTML});
      setAttrs(dest,{transform: `scale(${parts[p].scale})`});
    }
  }



  //⭐ SETUP GNAR model components.
  const gnar_parts = {
    cheese:{
      parts: parts['#CHZ'],
      transform:{t:-0.5, s:10.0},
      no_normal: true,
      has_marker: true,
      extruded: 2.0,
      show_extruded_planes: true,
    },
    // circle:{
    //   parts: parts['#CIR'],
    //   transform:{t:-0.5, s:1.0},
    //   no_normal: true,
    //   special:'scale-to-distance'
    // },
    // plane:{
    //   parts: parts['#PLANE'],
    //   transform:{t:-0.5, s:100.0},
    // }
  }

  //⭐ SETUP GNAR
  for(let p of Object.keys(gnar_parts)){
    const gnar = g_gnarly(proj, p, gnar_parts[p], index);
    if(gnar){
      gnar.name = p;
      gnar.index = index;
      setAttrs(gnar.svg,{'id':`${p}-base`,'data-index':index});
      model.appendChild(gnar.svg);
      objects_map.set(index, gnar);
      index++;
    }
  }



  //⭐ USING ONLY THE MATH LIBRARY: GL_MATRIX.
  proj.init(index, points ** 3, spread, default_cam_distance, width, height, projector_messaging);
  order = new Uint16Array(objects_map.size);


  const direction_event_handler = (evt) => {
    if(target){
      const n = objects_map.get(Number(target.dataset.index));//find((p) => (p.index === Number(target.dataset.index)));

      if(n.name === 'grid'){
        vec3.add(uv, n.loc, proj.grid_position);
        vec3.copy(marker_position, uv);
        vec3.negate(uv, uv);
        vec3.copy(proj.destination_pos, uv);
        vec3.copy(pos.mover.pos, proj.world_position);
        pos.mover.direct(uv);
      }

      if(n.name === 'plane'){
        vec3.copy(pos.mover.pos, proj.world_position);
        vec3.copy(marker_position, [0,0,0]);
        pos.mover.direct([0,0,0]);
      }
    }
  }

  // 📌 setup events on svg elemets:
  objects_map.forEach((n,i) =>{

    const gets_event = (n.name === 'sugarcube' || n.name === 'grid' || n.name === 'plane' || n.name === 'pos');
    if(gets_event){
      // setAttrs(n.svg,{'style':'pointer-events:all;'});
      n.svg.addEventListener('mouseenter', (evt) => {
        target = evt.target;
        log.target = target.id;
        if(n.name === 'plane'){
          vec3.copy(marker_position, [0,0,0]);
          info.set(marker_position, n.siz, [target.id, [0,0,0]]);
        }
        if(n.name === 'grid'){
          vec3.add(uv, n.loc, proj.grid_position);
          vec3.copy(marker_position, uv);
          info.set(marker_position, n.siz, [target.id, [uv]]);
        }
        if(n.name === 'pos'){
          vec3.negate(marker_position, proj.world_position);
          const p = [...proj.world_position].map((v) => v.toFixed(2));
          info.set(n.loc, n.siz, [target.id, [p]]);
        }

        if(n.name === 'sugarcube'){
          console.log(n.stat());
        }

        n.svg.style.filter = `brightness(2) drop-shadow(${n.base_color} 0px 0px ${n.siz*12}px)`;
        
      },false);

      n.svg.addEventListener('mouseleave', (evt) => {
        n.svg.style.filter = 'none';
      },false);

      n.svg.addEventListener('mouseup', direction_event_handler, false);

    }else{
      setAttrs(n.svg,{'style':'pointer-events:none;'});
    }
  });

  superlative.addEventListener('mouseup', direction_event_handler, false);





  if(LOOP_STYLE){
    requestAnimationFrame(loop);
  }else{
    loop(1);
    // loop(2);
  }
  
  environment.focus();

  // const m_event = new Event("mouseleave");
  
  // // let clickEvent = document.createEvent('MouseEvents');
  // // clickEvent.initEvent (eventType, true, true);
  // environment.dispatchEvent(m_event);
  
  
  const mouseenter = new MouseEvent("mouseover", {
    bubbles: true,
    cancelable: false
  });
  
  environment.dispatchEvent(mouseenter);
  


}

load_svg_icons(icon_loader).then(pk => setup_and_run(pk));









