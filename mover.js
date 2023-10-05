import { vec3 } from "gl-matrix";

export const mover = () => {
    const vw = vec3.create();

    const direct = (tgt) => {
        vec3.copy(mo.target, tgt);
        mo.is_moving = true;
    }

    const go = (at) => {
        if(!mo.is_moving) return;
    
        const t_delta = at;//*1000;

        vec3.sub(vw, mo.target, mo.pos);
        // vw.subVectors(mover.target, mover.pos);

        vec3.scale(mo.d, vw, mo.attenuation);
        // mover.d.copy(vw).multiplyScalar(mover.attenuation);

        const m = vec3.length(mo.d);
        //mover.d.length();

        vec3.sub(vw, mo.del_pos, mo.pos);
        const delta_p = vec3.length(vw);
        // const delta_p = vw.subVectors(mover.del_pos, mover.pos).length();
        mo.vd =  delta_p / t_delta;
        const r = 1 - (mo.vd * t_delta) / m;

        vec3.normalize(mo.ac, mo.d);
        vec3.scale(mo.ac, mo.ac, mo.speed);

        // mover.ac.copy(mover.d).normalize().multiplyScalar(mover.speed);

        vec3.copy(mo.del_pos, mo.pos);
        // mover.del_pos.copy(mover.pos);

        if ( r > 0 ){
            
            vec3.add(vw, mo.vl, mo.ac);
            vec3.scale(mo.vl, vw, r);
            // mover.vl.add(mover.ac).multiplyScalar(r);
            vec3.add(mo.pos, mo.pos, mo.vl);
            // mover.pos.add(mover.vl);
            
        }else{
            mo.is_moving = false;
            vec3.set(mo.vl,0,0,0);
            // mo.vl.set(0,0,0);
        }
    

    }

    const eol = () => {
        vec3.set(mo.vl,0,0,0);
        mo.is_moving = false;
        return 0;
    }

    const mo = {
        name: 'synthetic_displacement_v2_gl_matrix_vec3',
        d: vec3.create(),
        ac: vec3.create(),
        vl: vec3.create(),
        target: vec3.create(),
        pos: vec3.create(),
        del_pos: vec3.create(),
        vd: 0.0,
        attenuation: 0.6,
        speed: 0.085, //65,
        is_moving: false,
        direct,
        go,
        eol
    }
    
    return mo;
}
