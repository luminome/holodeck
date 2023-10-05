import './style.css'
import { event } from "ts-modules-vite/build/modules/events-massive/event-handler";
import { vec3 } from "gl-matrix";
import { projector, _set_buffer, _get_buffer } from "./projector.js";
import { mover } from "./mover.js"
import {g_point, g_square_path} from "./model-objects.js";

const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;

// 📌 make app body-html:
document.querySelector('#app').innerHTML = `

<svg id="environment" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <g id="zones">
    <circle id="superlative" cx="0" cy="0" r="22" fill="gray" style="opacity:0.75;"/>
  <g>
  <g id="model">

  <g>
</svg>

<svg id="autonomous_info_region" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">

</svg>

<div id="output"></div>
<div id="refresh-button">
  <a href="/">
    <svg width="48" height="48" class="icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <circle id="svg_origin" cx="24" cy="24" r="22" fill="gray" style="opacity:0.75;"/>
      <g transform="translate(8,8) scale(0.064)">
        <g>
          <path d="M122.941,374.241c-20.1-18.1-34.6-39.8-44.1-63.1c-25.2-61.8-13.4-135.3,35.8-186l45.4,45.4c2.5,2.5,7,0.7,7.6-3
            l24.8-162.3c0.4-2.7-1.9-5-4.6-4.6l-162.4,24.8c-3.7,0.6-5.5,5.1-3,7.6l45.5,45.5c-75.1,76.8-87.9,192-38.6,282
            c14.8,27.1,35.3,51.9,61.4,72.7c44.4,35.3,99,52.2,153.2,51.1l10.2-66.7C207.441,421.641,159.441,407.241,122.941,374.241z"/>
          <path d="M424.941,414.341c75.1-76.8,87.9-192,38.6-282c-14.8-27.1-35.3-51.9-61.4-72.7c-44.4-35.3-99-52.2-153.2-51.1l-10.2,66.7
            c46.6-4,94.7,10.4,131.2,43.4c20.1,18.1,34.6,39.8,44.1,63.1c25.2,61.8,13.4,135.3-35.8,186l-45.4-45.4c-2.5-2.5-7-0.7-7.6,3
            l-24.8,162.3c-0.4,2.7,1.9,5,4.6,4.6l162.4-24.8c3.7-0.6,5.4-5.1,3-7.6L424.941,414.341z"/>
        </g>
      </g>
    </svg>
  </a>
</div>
`

const environment = document.querySelector('#environment');
const info_svg = document.querySelector('#autonomous_info_region');
const superlative = document.querySelector('#superlative');
const model = document.querySelector('#model');
const output = document.querySelector('#output');

const uv = vec3.create();
const proj = projector();
let STOPPED_EXEC = false;
let DEPTH_ENABLE = true;
let LOOP_STYLE = true;

const toggled = {
  Space: false,
  Tab: true,
  Digit1: true,
}

let toggle_check = Object.keys(toggled);

// 📌 setupevent callback "cb_radio":
const cb_radio = (event, args) => {

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
}

event(document.body, cb_radio, {'type':'keyboard', 'toggle_keys':toggle_check, 'interval':50});
const _ET = event(environment, cb_radio, {'type':'screen', 'interval':0, 'context_disable':true});

const log = {
  y_deg:0,
  proj_msg:'',
  reordered: 0,
  target: undefined,
  frame: 0
}

// 📌 set static vars here:
const points = 4;
const spread = 20;
const objects_array = [];
const default_cam_distance = 50.0;
const grid_point_size = 4.0;
const grid_point_text = false;
let index = 0;
proj.evt = _ET;
let proto_scale_vertical = 1.0;
let target = undefined;

export const setAttrs = (e, a) => Object.entries(a).forEach(([k,v]) => e.setAttribute(k,v));

const projector_messaging = (msg) => log.proj_msg = msg;

// utility to manually set the dom order of elements.
const insertAfter = (newNode, existingNode) => existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);


const pretty_ass_info_marker = () => {

  const body = () => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    setAttrs(g,{
      'id':'info-marker',
      'class':'info-fadein',
      'style':'pointer-events:all;'
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
      style:'opacity:0.5;'
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
      r:(I.Siz*rel_size)-2, //4px outline line
      // 'class':'info-fadein',
    });

    setAttrs(I.svg_item,{
      r:I.Siz*rel_size
    });

    setAttrs(I.text,{
      y:(I.Siz*rel_size)//;//+I.fontSiz
    });

    if(ref_string){
      // text added, not null (updating position only).
      I.element.style.opacity = '1.0';
      superlative.style.opacity = '0.25';

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
    Siz:60,
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
  objects_array.push(e);
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
      e.base_color = 'yellow';
      e.base_siz = grid_point_size;
    }
  }
}

//⭐ SETUP USER.
const user = add_point('user');
user.base_color = 'red';
setAttrs(user.svg,{id:'user-canon'});

//⭐ SETUP CENTER.
const center = add_point('center');
center.base_color = 'white';

//⭐ SETUP Scale POINT.
const scaler = add_point('scaler');
scaler.base_color = 'magenta';

//⭐ SETUP POS POINT.
const pos = add_point('pos');
pos.base_color = 'pink';
pos.mover = mover();
setAttrs(pos.svg,{'id':'position'});

// 📌 flag zero:
objects_array[0].base_color = 'white';

//⭐ SETUP PLANE.
const test = g_square_path(index, proj).init();
test.name = 'plane';
setAttrs(test.svg,{'id':'plane-base'});
model.appendChild(test.svg);
objects_array.push(test);
index++;





//⭐ USING ONLY THE MATH LIBRARY: GL_MATRIX.
proj.init(index, points ** 3, spread, default_cam_distance, width, height, projector_messaging);
const order = new Uint16Array(objects_array.length);


const direction_event_handler = (evt) => {
  if(target){
    const n = objects_array.find((p) => (p.index === Number(target.dataset.index)));

    if(n.name === 'grid'){
      vec3.add(uv, n.loc, proj.stat.grid);
      vec3.negate(uv,uv);
      vec3.copy(proj.destination_pos, uv);
      vec3.copy(pos.mover.pos, proj.stat.world);
      pos.mover.direct(uv);
    }

    if(n.name === 'plane'){
      vec3.copy(pos.mover.pos, proj.stat.world);
      pos.mover.direct([0,0,0]);
      // vec3.set(proj.destination_pos, 0, 0, 0);
    }
  }
}

// 📌 setup events on svg elemets:
for(let n of objects_array){
  const gets_event = (n.name === 'grid' || n.name === 'plane' || n.name === 'pos');
  if(gets_event){
    setAttrs(n.svg,{'style':'pointer-events:all;'});
    n.svg.addEventListener('mouseenter', (evt) => {
      target = evt.target;
      log.target = target.id;
      if(n.name === 'plane'){
        info.set(proj.stat.world, n.Siz, [target.id, [0,0,0]]);
      }
      if(n.name === 'grid'){
        vec3.add(uv, n.loc, proj.stat.grid);
        info.set(n.px_loc, n.Siz, [target.id, [uv]]);
      }
      if(n.name === 'pos'){
        const p = [...proj.stat.world].map((v) => v.toFixed(2))
        info.set(n.px_loc, n.Siz, [target.id, [p]]);
      }
    },false);
    n.svg.addEventListener('mouseup', direction_event_handler, false);

  }else{
    setAttrs(n.svg,{'style':'pointer-events:none;'});
  }
}

superlative.addEventListener('mouseup', direction_event_handler, false);


//⭐ LOOP! THIS IS ORIGINAL LUMINOME.
const loop = (frame) => {
  if(!STOPPED_EXEC){
    // fucking incredible.
    // log.frame = frame;

    if(pos.mover.is_moving){
      pos.mover.go(frame);
      vec3.copy(proj.destination_pos, pos.mover.pos);
    } 

    proj.update(); //update matrices.



    for(let n of objects_array){
      const r = proj.project(n);
      const existing_style_attrib = n.svg.getAttribute('style');

      if(n.type === 'point'){
        // 📌 optical 2d distortion brought to you by "scaler" point.
        if(n.name === 'scaler'){
          proto_scale_vertical = Math.abs(r[2]);
          log.y_deg = proto_scale_vertical.toFixed(2);
        } 

        const s = 1.0;//n.name === 'user' ? proto_scale_vertical : 1.0;
        
        if(n.Z > 0) continue;

        if(!isNaN(n.px_loc[0]) && !isNaN(n.px_loc[1]) && n.Siz >= 0){
          setAttrs(n.svg_item,{
            'transform': `scale(${s})`,
            r:(n.Siz*n.base_siz).toFixed(2),
            fill: n.base_color
          });
          if(grid_point_text){
            setAttrs(n.svg_text,{'transform': `scale(${n.Siz*1.2})`});
            n.svg_text.innerHTML = n.index+'|'+n.D;
          }
          
          setAttrs(n.svg,{
            'transform': `translate(${n.px_loc[0].toFixed(2)}, ${n.px_loc[1].toFixed(2)})`,
            'style':`${existing_style_attrib}opacity:${n.Siz}`
          });
        }
      }else{
        n.update();
        setAttrs(n.svg_item,{
          fill:n.base_color
        });
      }

    }








    // Now we can sort it. Sort by distance from camera
    let reported = 0;
    if(DEPTH_ENABLE){
      objects_array.sort((a, b) => Number(b.D) - Number(a.D));
      
      
      for(let i = 0; i < objects_array.length; i++) {
        if(order[i] !== objects_array[i].index){
          order[i] = objects_array[i].index;

          // the element in question;
          const q_el = model.querySelector(`g[data-index="${order[i]}"]`);

          const obj = objects_array[order[i]];
          obj.type === 'point' && setAttrs(obj.svg_item, {fill:'yellowgreen'});

          // the element before it in index-order;
          const b_el = model.childNodes[i];
          insertAfter(q_el, b_el);
          reported++;
        }
      }
      
    }

    log.reordered = DEPTH_ENABLE === true ? reported : 'disabled';

    output.innerHTML = '';
    Object.entries(log).forEach(([k,v]) => output.innerHTML += `<div>${k}</br><b>${v}</b></div>`);
    
    if(target){
      const in_list = objects_array.find((p) => (p.index === Number(target.dataset.index)));
      if(in_list.name === 'plane'){
        const c = objects_array.find((p) => (p.name === 'center'));
        const [x,y] = c.px_loc;
        info.set([x,y], in_list.Siz);
      }else{
        const [x,y] = in_list.px_loc;
        info.set([x,y], in_list.Siz);
      }
    }

  }
  LOOP_STYLE && window.requestAnimationFrame(loop);
}


LOOP_STYLE && window.requestAnimationFrame(loop);
