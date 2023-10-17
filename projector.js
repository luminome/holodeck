import { vec3, vec4, vec2, mat4, glMatrix } from "gl-matrix";

const _set_buffer = (buf, i, a) => {
    buf[i*3] = a[0];
    buf[i*3+1] = a[1];
    buf[i*3+2] = a[2];
}

const _get_buffer = (buf, i) => [buf[i*3], buf[i*3+1], buf[i*3+2]];


const projector = () => {
    let z_order_indexes, z_depth_buffer, z_depth_stack, point_count, point_spread, general_D, grid_offset;

    const e = {
        X_rot: 0,
        Y_rot: 0,
        Z_dep: 0,
        X_pos: 0,
        Y_pos: 0
    }

    const dec_p = 6; //decimal places
    const z_order  = new Map;
    const viewMatrix = new Float32Array(16);
    const projMatrix = new Float32Array(16);
    const modelMatrix = new Float32Array(16);
    const cameraMatrix = new Float32Array(16);
    const world_position = vec3.create();
    const grid_position = vec3.create();
    const world_position_d = vec3.create();
    const camera_util = vec3.create();
    const camera_position = vec3.create();
    const camera_base_position = vec3.create();
    const camera_world_position = vec3.create();
    const user_world_pos = vec3.create();
    const user_world_pos_d = vec3.create();

    const ray = vec3.create();
    const u = vec3.create();
    const uw = vec3.create();
    const fin = vec3.create();

    const m_pre = vec4.create();
    const model_view = vec3.create();
    const model_view_proj = vec3.create();

    const xRotationMatrix = new Float32Array(16);
    const yRotationMatrix = new Float32Array(16);
    const identityMatrix = new Float32Array(16);

    const uv = vec4.create();
    const uv3 = vec3.create();

    let check_down_state = false;
    let check_action_state = false;
    let zoom_style = 'basic';

    const interp = (X,Y,t) => X*t + Y*(1-t);

    const set_projection = () => {
        mat4.perspective(projMatrix, glMatrix.toRadian(45), P.view.width / P.view.height, 0.1, 2000.0);
    }

    // const initialize_depth_sort = () => {
    //     if (point_count > 0) {
    //         for (let j = 0; j < point_count; j += 1) {
    //             z_order.set(j, [j, 0.0]);
    //         }
    //     }
    // }

    // const depth_sort = () => {
    //     let j, k, temp;

    //     for (j = 0; j < point_count; j += 1) {
    //         const index = z_order.get(j)[0];
    //         z_order.set(j,[index, z_depth_buffer[index]]);
    //         // z_depth_stack[index] = j;
    //         // z_order_indexes[j] = index;
    //     }

    //     // Perform an insertion sort on the models.
    //     for (j = 0; j < point_count; j += 1) {
    //         temp = z_order.get(j);
    //         // if(!temp) continue;
    //         k = j - 1;
    //         while (k >= 0 && z_order.get(k)[1] <= temp[1]) {
    //             z_order.set(k + 1, z_order.get(k));
    //             k -= 1;
    //         }
    //         z_order.set(k + 1, temp);
    //     }
    // }

    // const depth_report = () => {
    //     let n = 0;
    //     const report = [];
    //     z_order.forEach((value, i) => {
    //         //⭐💀 killed it.
    //         if(value[0] > -1 && z_depth_stack[value[0]] !== i) report.push([value[0], z_order_indexes[i-1]]);
    //         // if(z_depth_stack[value[0]] !== i) report.push([value[0], i > 0 ? z_order_indexes[i-1]:0]);
    //         z_depth_stack[value[0]] = i;
    //         z_order_indexes[i] = value[0];
    //     });
    //     return report;
    // }

    //⭐ save last user world position and world position;
    const save_user_and_world_pos = () => {
        vec3.copy(user_world_pos_d, user_world_pos);
        vec3.copy(world_position_d, world_position);
        e.X_pos = P.evt.origin[0];
        e.Y_pos = P.evt.origin[1];
        return true;
    }

    const reset_evt_origin = () => {
        e.X_pos = P.evt.origin[0];
        e.Y_pos = P.evt.origin[1];
        return true;
    }






    const update_matrices = () => {
        const projector_message = [];
        // 📌 filter to check for "drag" state w/out "down" as applied to event origin position.
        // this is because animationframe driven loop might miss event type.
        if(P.evt.mode === 'set-offset-pos'){
            if(P.evt.type_meta === 'down') check_action_state = reset_evt_origin();
            if(P.evt.type_meta === 'drag' && !check_action_state) check_action_state = reset_evt_origin();
            if(P.evt.type_meta === 'up'){
                check_action_state = false;
                check_down_state = false;
            } 
        } 

        [
            ['X_rot', P.evt.offset.x],
            ['Y_rot', P.evt.offset.y],
            ['Z_dep', P.evt.offset.z],
            ['X_pos', P.evt.origin[0]],
            ['Y_pos', P.evt.origin[1]]
        ].forEach((v) => {e[v[0]] = interp(e[v[0]], v[1], P.lerp)});


        //⭐ apply world position to camera world position;
        vec3.sub(camera_world_position, camera_position, world_position);

        //⭐ set scale;
        const z_offset = (e.Z_dep)/(P.zoom_threshold);
        P.scale = (1-(z_offset));
        P.scale_offset = (P.scale/P.scale_d);
        P.scale_d = P.scale;

        //⭐ unproject cursor(user) position;
        const v = unproject_user();
        if(v){
            // https://stackoverflow.com/questions/5666222/3d-line-plane-intersection
            // vec3.sub(v, v, world_position);
            vec3.sub(ray, camera_world_position, v);
            // vec3.transformMat4(uv, camera_base_position, cameraMatrix);
            // const cam_in = vec3.fromValues(cameraMatrix[8],cameraMatrix[9],cameraMatrix[10]);
            // vec3.sub(uv3, world_position, cam_pos_world);
            // vec3.scale(uv3,cam_in,-200);
            // vec3.normalize(uv3, cam_in);///[0,0,-1]
            // vec3.negate(uv3,uv3);
            // vec3.add(uv3,uv3,world_position);
            // vec3.set(uv3, cameraMatrix[8], cameraMatrix[9], cameraMatrix[10]); //p_no
            vec3.normalize(uv3, camera_position); //p_no
            // vec3.sub(uv3,uv3,world_position);
            
            // w = sub_v3v3(p0, p_co)
            // fac = -dot_v3v3(p_no, w) / dot
            // u = mul_v3_fl(u, fac)

            // vec3.sub(u, p1, p0)

            const dotprod = vec3.dot(uv3, ray);
            if( Math.abs(dotprod) > 1e-6){
                vec3.add(uw, v, world_position);
                const fac = -vec3.dot(uv3, uw) / dotprod;

                vec3.scale(u, ray, fac);
                vec3.add(fin, v, u);
                // vec3.add(uv3, fin, world_position);
                vec3.copy(user_world_pos, fin);
            }
        }

        //⭐ handle interaction;
        if(P.evt.mode === 'set-offset-pos'){
            projector_message.push(`${P.evt.type} ${P.evt.type_meta}`);
            let interacted = false;
            if(P.evt.type_meta === 'drag'){
                if(!check_down_state) check_down_state = save_user_and_world_pos();
                vec3.sub(uv3, user_world_pos_d, user_world_pos);
                vec3.sub(world_position_d, world_position_d, uv3);
                vec3.copy(world_position, world_position_d);
                interacted = true;
            }

            if(P.evt.type === 'wheel' || P.evt.type_meta === 'drag-special'){
                vec3.scale(camera_base_position, camera_base_position, P.scale_offset);
                if(zoom_style === 'point'){
                    vec3.scale(uv3, world_position, -1);
                    vec3.sub(uv3, uv3, user_world_pos);
                    projector_message.push(`pl ${[...uv3].map((n) => n.toFixed(2))}`);
                    vec3.scale(uv3, uv3, (1 - P.scale_offset));
                    vec3.add(world_position, world_position, uv3);
                }
                interacted = true;
            }

            projector_message.push(`wd ${[...world_position].map((n) => n.toFixed(2))}`);
            projector_message.push(`so ${P.scale_offset.toFixed(2)}`);

            interacted && vec3.copy(P.destination_pos, world_position);
        }

        vec3.lerp(world_position, world_position, P.destination_pos, 0.9);
        // vec3.add

        P.message(projector_message.join('</br>'));

        const [gx,gy,gz] = world_position;
        const rgx = Math.round(-gx/point_spread)*point_spread;
        const rgy = Math.round(-gy/point_spread)*point_spread;
        const rgz = Math.round(-gz/point_spread)*point_spread;
        vec3.set(grid_position, rgx-grid_offset, rgy+grid_offset, rgz-grid_offset);

        mat4.rotate(yRotationMatrix, identityMatrix, e.X_rot, [0,0,1]);
        mat4.rotate(xRotationMatrix, identityMatrix, e.Y_rot, [1,0,0]);
        mat4.mul(cameraMatrix, yRotationMatrix, xRotationMatrix);
        const cam_up = vec3.fromValues(cameraMatrix[4],cameraMatrix[5],cameraMatrix[6]);

        vec3.transformMat4(camera_util, camera_base_position, cameraMatrix);
        vec3.copy(camera_position, camera_util);
        mat4.lookAt(viewMatrix, camera_position, [0,0,0], cam_up);
        mat4.translate(modelMatrix, identityMatrix, world_position);

        P.z_rotation = e.X_rot;

        // P.stat = {
        //     'world':world_position,
        //     'grid':grid_position,
        //     'user':user_world_pos};
        // depth_sort();
        // P.depth_stack = depth_report();
    }

    const unproject_user = () => {
        //https://stackoverflow.com/questions/42309715/how-to-correctly-pass-mouse-coordinates-to-webgl
        const x = e.X_pos / P.view.width * 2 - 1;
        const y = e.Y_pos / P.view.height * -2 + 1;
        const viewZ = vec3.length(camera_position);//camera_base_position[2];///-general_D;
        const clip = vec3.create();
        const worldpos = vec3.create();

        vec3.transformMat4(clip, [0, 0, viewZ], projMatrix);
        const z = clip[2];

        const v_by_p = mat4.create();
        mat4.multiply(v_by_p, projMatrix, viewMatrix);
        mat4.multiply(v_by_p, v_by_p, modelMatrix);
        
        const v_by_p_inv = mat4.create();
        mat4.invert(v_by_p_inv, v_by_p);

        vec3.transformMat4(worldpos, [x, y, z], v_by_p_inv);
        return worldpos;
    }

    /**
     * @param {*} element is object or array[3](x,y,z);
     */
    const project = (element) => {
        // need good way to assert that element is an instance of point from main.js.
        const full = element.constructor.name === 'Object';
        // console.log(full);
        if(full){
            if(element.name === 'user') vec3.copy(uv3, user_world_pos);
            if(element.name === 'grid') vec3.add(uv3, element.loc, grid_position);
            if(element.name === 'center') vec3.copy(uv3, element.loc);
            if(element.name === 'scaler') return vec3.normalize(uv3, camera_position);
            if(element.name === 'pos') vec3.negate(uv3, world_position);
        }else{
            vec3.copy(uv3, element);
        }

        const D = camera_base_position[2];
        vec4.set(m_pre, uv3[0], uv3[1], uv3[2], 1.0);

        vec4.transformMat4(uv, m_pre, modelMatrix);
        vec4.transformMat4(uv, uv, viewMatrix);
        vec3.copy(model_view, uv);

        // if(full) m_v = vec3.fromValues(uv[0],uv[1],uv[2]);
        vec4.transformMat4(uv, uv, projMatrix);
        uv[0] /= uv[3];
        uv[1] /= uv[3];
        var pixelX = (uv[0] *  0.5 + 0.5) * P.view.width;
        var pixelY = (uv[1] * -0.5 + 0.5) * P.view.height;

        //should return (px:[x,y], z:Z, d:D)

        if(full){
            vec2.set(element.px_loc, pixelX, pixelY);
            element.Z = model_view[2];
            element.Siz = ((general_D*0.4) / -model_view[2]);
            //📝 set depth: it's dangerous to try and solve this for 2-d objects.
            element.D = Math.round(vec3.squaredDistance(uv3, camera_world_position));
        }else{
            return [pixelX, pixelY];//[Number(pixelX.toFixed(2)), Number(pixelY.toFixed(2))];
        }

    }

    const project_sm = (v3) => {
        vec4.set(uv, v3[0], -v3[1], v3[2], 1.0);
        vec4.transformMat4(uv, uv, modelMatrix);
        vec4.transformMat4(uv, uv, viewMatrix);
        const S = uv[2];
        vec4.transformMat4(uv, uv, projMatrix);
        const Z = uv[2];
        uv[0] /= Math.abs(uv[3]);
        uv[1] /= Math.abs(uv[3]);
        const [px,py] = [((uv[0] * 0.5 + 0.5) * P.view.width), (uv[1] * -0.5 + 0.5) * P.view.height];
        const D = Math.round(vec3.squaredDistance(v3, camera_world_position));
        return {
            p: [px,py], //[Number(px.toFixed(dec_p)), Number(py.toFixed(dec_p))], 
            z: Number(Z.toFixed(dec_p)),
            s: Number(S.toFixed(dec_p)),
            d: D
        };
    }

    const init = (point_ct, grid_point_ct, spread, cam_z, width, height, messaging_callback = null) => {
        // number_points = point_count;//arbitrary
        mat4.identity(identityMatrix);
        mat4.identity(xRotationMatrix);
        mat4.identity(yRotationMatrix);
        mat4.identity(viewMatrix);
        mat4.identity(projMatrix);
        mat4.identity(modelMatrix);
        mat4.identity(cameraMatrix);

        vec3.set(camera_position, 0, -cam_z, -cam_z);
        vec3.set(camera_base_position, 0, 0, cam_z);
        
        P.default_cam_distance = cam_z;
        P.zoom_threshold = 400;
        P.scale = 1.0;
        P.scale_d = 1.0;

        point_count = point_ct;
        point_spread = spread;

        // general_D = cam_z;
        z_depth_buffer = new Uint16Array(point_count*2);
        z_depth_stack = new Uint16Array(point_count*2);
        z_order_indexes = new Uint16Array(point_count*2);

        P.view = {width:width, height:height};
        P.message = messaging_callback;
        
        // console.log("worldMatrix", worldMatrix);
        console.log(point_count, grid_point_ct);

        grid_offset = ((Math.cbrt(grid_point_ct)-1)/2) * point_spread;

        // const spd = ((Math.cbrt(point_count)-1)/2) * point_spread;
        // vec3.set(world_position,-spd,spd,-spd);

        vec3.set(camera_base_position, 0.0, 0.0, P.default_cam_distance);

        P.lerps = [
            ['X_rot', P.evt.offset.x],
            ['Y_rot', P.evt.offset.y],
            ['Z_dep', P.evt.offset.z],
            ['X_pos', P.evt.origin[0]],
            ['Y_pos', P.evt.origin[1]]
        ]

        P.lerp = 0.85;

        P.destination_pos = vec3.create();

        
        // initialize_depth_sort();
        set_projection();
    }
    
    const P = {
        default_cam_distance: undefined,
        evt: undefined,
        origin: undefined,
        offset: undefined,
        offset_pos: undefined,
        delta: undefined,
        view: undefined,
        depth_stack: undefined,
        message: undefined,

        'z_rotation': e.X_rot,

        'world_position': world_position,
        'grid_position': grid_position,
        'user_world_pos': user_world_pos,
        'camera_position': camera_position,
        'camera_world_position': camera_world_position,

        init: init,
        project: project,
        project_sm: project_sm,
        update: update_matrices,
        
    }

    return P;
}

export { projector, _set_buffer, _get_buffer };