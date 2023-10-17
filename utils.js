const SVG_NS = "http://www.w3.org/2000/svg";

const setAttrs = (e, a) => Object.entries(a).forEach(([k,v]) => e.setAttribute(k,v));

const createSVGElement = (name, props, ...classes) => {
    const element = document.createElementNS(SVG_NS, name);
    props && setAttrs(element,props);
    classes && classes.forEach(c => element.classList.add(c));
    return element;
  }


const load_svg_icons = async (target) => {
    return fetch('./icons.svg')
    .then((response) => response.text())
    .then((text) => {return (text)});
}

const transform_svg_data = (path_data, transform = {t:0, s:1.0}) => {
    for(let i=0; i<path_data.length; i++){
        for(let j=0; j<path_data[i].values.length; j++){
            path_data[i].values[j] += transform.t;
            path_data[i].values[j] *= transform.s;
        }
    }
}

// const path_data_map = (path_data, transform = {t:0, s:1.0}) => {
//     for(let i=0; i<path_data.length; i++){
//         for(let j=0; j<path_data[i].values.length; j++){
//             path_data[i].values[j] += transform.t;
//             path_data[i].values[j] *= transform.s;
//         }
//     }
// }
  
const resize_svg_paths = (parts) => {
    const dec_p = 10;
    let [mx, my] = [[],[]];
    const r_normalized = [];
    const build = [];

    parts.forEach((p,i)=>{
        let normalizedPathData = p.getPathData({normalize: true});
        r_normalized.push(normalizedPathData);
        for(let c of normalizedPathData){
            for(let i=0; i<c.values.length; i++){
                const n = c.values[i];
                if(i % 2 == 0){
                    mx.push(n);
                }else{
                    my.push(n);
                }
            }
        }
    });

    const [w,h] = [Math.max(...mx)-Math.abs(Math.min(...mx)), Math.max(...my)-Math.abs(Math.min(...my))]
    const D = Math.max(w,h)
    
    r_normalized.forEach((p, indx) => {
        const p_original_type = parts[indx].nodeName;
        const p_original_id = parts[indx].id;

        for(let i=0; i<p.length; i++){
            const kvc = p[i].values.length;
            for(let j=0; j<kvc; j++){
                p[i].values[j] = Math.round((p[i].values[j]/D)*(10 ** dec_p))/(10 ** dec_p);
            }
        }

        let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute('style', parts[indx].style.cssText); //preserve styles (fill etc)
        path.setAttribute('id', `${p_original_id}`);

        if(p_original_type !== 'path'){
        path.setPathData(p);
        build.push(path);
        }else{
        path.setPathData(p);
        build.push(path);
        }
  
    });

    return build;
}

const insertAfter = (newNode, existingNode) => existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);

const sortDomByDistance = (dom, list_map, order, index_offset=0) => {
    const re_list = [...list_map.values()];
    re_list.sort((a, b) => Number(b.dist) - Number(a.dist));
    let reported = 0;
    re_list.forEach((p, i) => {
        if(order[i] !== p.index){
            order[i] = p.index;
            const q_el = dom.querySelector(`[data-index="${order[i]}"]`);
            const b_el = dom.childNodes[i];
            // console.log(i, order[i], q_el);
            insertAfter(q_el, b_el);
            reported++;
        }
    });

    // for(let i = 0; i < list.length; i++) {
    //     // const p_index = list[i].index
    //     if(order[i] !== list[i].index){
    //         order[i] = list[i].index;
    //         const q_el = dom.querySelector(`[data-index="${order[i]}"]`);
    //         const b_el = dom.childNodes[i];
    //         // console.log(q_el, b_el, i, order);
    //         insertAfter(q_el, b_el);
    //         reported++;
    //     }
    // }
    return reported;
}

export { setAttrs, createSVGElement, load_svg_icons, resize_svg_paths, transform_svg_data, sortDomByDistance, insertAfter }

