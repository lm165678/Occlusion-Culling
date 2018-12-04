function initialize() {

    var occlusionCullingEnabled = true;
    var showHUD = true;

    // document.getElementById("occlusion-toggle").addEventListener("change", function() {
    //     occlusionCullingEnabled = this.checked;
    //     for(var i = 0, len = spheres.length; i < len; i++) {
    //         spheres[i].occluded = false;
    //     }
    // });
    //
    // document.getElementById("hud-toggle").addEventListener("change", function() {
    //     showHUD = this.checked;
    // });
    //
    var sphereCountElement = document.getElementById("num-spheres");
    var occludedSpheresElement = document.getElementById("num-invisible-spheres");

    var canvas = document.getElementById("gl-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var gl = canvas.getContext("webgl2");
    if (!gl) {
        console.error("WebGL 2 not available");
        document.body.innerHTML = "This example requires WebGL 2 which is unavailable on this system."
    }

    var hudViewport = [
        gl.drawingBufferWidth/1.5,
        0,
        gl.drawingBufferWidth / 3,
        gl.drawingBufferHeight / 3
    ];

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    /////////////////////
    // SET UP PROGRAM
    /////////////////////

    var drawVsSource =  vertex_shader.trim();
    var drawFsSource =  fragment_shader.trim();

    var drawVertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(drawVertexShader, drawVsSource);
    gl.compileShader(drawVertexShader);

    if (!gl.getShaderParameter(drawVertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(drawVertexShader));
    }

    var drawFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(drawFragmentShader, drawFsSource);
    gl.compileShader(drawFragmentShader);

    if (!gl.getShaderParameter(drawFragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(drawFragmentShader));
    }

    var program = gl.createProgram();
    gl.attachShader(program, drawVertexShader);
    gl.attachShader(program, drawFragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
    }

    var boundingBoxVSource =  vertex_boundingBox.trim();
    var boundingBoxFSource =  fragment_boundingBox.trim();

    var boundingBoxVertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(boundingBoxVertexShader, boundingBoxVSource);
    gl.compileShader(boundingBoxVertexShader);

    if (!gl.getShaderParameter(boundingBoxVertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(boundingBoxVertexShader));
    }

    var boundingBoxFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(boundingBoxFragmentShader, boundingBoxFSource);
    gl.compileShader(boundingBoxFragmentShader);

    if (!gl.getShaderParameter(boundingBoxFragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(boundingBoxFragmentShader));
    }

    var boundingBoxProgram = gl.createProgram();
    gl.attachShader(boundingBoxProgram, boundingBoxVertexShader);
    gl.attachShader(boundingBoxProgram, boundingBoxFragmentShader);
    gl.linkProgram(boundingBoxProgram);

    if (!gl.getProgramParameter(boundingBoxProgram, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(boundingBoxProgram));
    }

    var hudVSSource =  vertex_hud.trim();
    var hudFSSoure =  fragment_hud.trim();
    var hudFSSoureOccluded = fragment_hud_occluded.trim();

    var hudVertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(hudVertexShader, hudVSSource);
    gl.compileShader(hudVertexShader);

    if (!gl.getShaderParameter(hudVertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(hudVertexShader));
    }

    var hudFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(hudFragmentShader, hudFSSoure);
    gl.compileShader(hudFragmentShader);

    if (!gl.getShaderParameter(hudFragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(hudFragmentShader));
    }

    var hudFragmentShaderOccluded = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(hudFragmentShaderOccluded, hudFSSoureOccluded);
    gl.compileShader(hudFragmentShaderOccluded);

    if (!gl.getShaderParameter(hudFragmentShaderOccluded, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(hudFragmentShaderOccluded));
    }

    var hudProgram = gl.createProgram();
    gl.attachShader(hudProgram, hudVertexShader);
    gl.attachShader(hudProgram, hudFragmentShader);
    gl.attachShader(hudProgram, hudFragmentShaderOccluded);
    gl.linkProgram(hudProgram);

    if (!gl.getProgramParameter(hudProgram, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(hudProgram));
    }

    /////////////////////////
    // GET UNIFORM LOCATIONS
    /////////////////////////

    // Main draw program locations
    var drawModelMatrixLocation = gl.getUniformLocation(program, "uModel");
    var drawTexLocation = gl.getUniformLocation(program, "tex");

    var sceneUniformsLocation = gl.getUniformBlockIndex(program, "SceneUniforms");
    gl.uniformBlockBinding(program, sceneUniformsLocation, 0);

    // Bounding box program locations
    var boundingBoxModelMatrixLocation = gl.getUniformLocation(boundingBoxProgram, "uModel");

    // Hud program locations
    var hudViewProjLocation = gl.getUniformLocation(hudProgram, "uViewProj");
    var hudModelMatrixLocation = gl.getUniformLocation(hudProgram, "uModel");
    //var hudModelMatrixLocationOccluded = gl.getUniformLocation(hudProgram, "name");

    /////////////////////
    // SET UP GEOMETRY
    /////////////////////

    var positionBuffer, uvBuffer, normalBuffer, indices;

    // Sphere geometry

    var sphereArray = gl.createVertexArray();
    gl.bindVertexArray(sphereArray);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.uvs, gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);

    normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(2);

    indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    // Bounding box geometry
    sphere.boundingBox = utils.computeBoundingBox(sphere.positions, {geo: true});

    var boundingBoxArray = gl.createVertexArray();
    gl.bindVertexArray(boundingBoxArray);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.boundingBox.geo.positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    gl.bindVertexArray(null);

    // Object definitions
    var GRID_DIM = 9;
    var GRID_OFFSET = GRID_DIM / 1 - 6.5;
    var NUM_SPHERES = GRID_DIM * GRID_DIM;
    var spheres = new Array(NUM_SPHERES);
    for(var k = 0; k < 5; ++k) {
    for (var i = 0; i < NUM_SPHERES; ++i) {
        var x = Math.floor(i / GRID_DIM) - GRID_OFFSET-5;
        var z = i % GRID_DIM/2 - GRID_OFFSET - 2;

        spheres[i] = {
            rotate: [0, z, z], // Will be used for global rotation
            translate: [x, x, z],
            modelMatrix: mat4.create(),

            vertexArray: sphereArray,
            numElements: sphere.indices.length,

            boundingBox: sphere.boundingBox,
            boundingBoxVertexArray: boundingBoxArray,
            boundingBoxNumVertices: sphere.boundingBox.geo.positions.length / 3,

            query: gl.createQuery(),
            queryInProgress: false,
            occluded: false
        };

        utils.xformMatrix(spheres[i].modelMatrix, spheres[i].translate);
    }
  }

    sphereCountElement.innerHTML = spheres.length;

    //////////////////////////
    // UNIFORM DATA
    //////////////////////////

    // scene main camera
    var projMatrix = mat4.create();
    mat4.perspective(projMatrix, Math.PI / 2, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100.0);

    var viewMatrix = mat4.create();
    var eyePosition = vec3.fromValues(0, 0, 5);
    mat4.lookAt(viewMatrix, eyePosition, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

    var viewProjMatrix = mat4.create();
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    // top down assist camera
    var projMatrixAssistCam = mat4.create();
    mat4.perspective(projMatrixAssistCam, Math.PI / 2, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100.0);

    var viewMatrixAssistCam = mat4.create();
    var eyePositionAssistCam = vec3.fromValues(0, 15, 0);
    mat4.lookAt(viewMatrixAssistCam, eyePositionAssistCam, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, -1));

    var viewProjMatrixAssistCam = mat4.create();
    mat4.multiply(viewProjMatrixAssistCam, projMatrixAssistCam, viewMatrixAssistCam);

    gl.useProgram(hudProgram);
    gl.uniformMatrix4fv(hudViewProjLocation, false, viewProjMatrixAssistCam);
    gl.useProgram(null);

    var lightPosition = vec3.fromValues(1, 1, 40);

    var modelMatrix = mat4.create();
    var rotateXMatrix = mat4.create();
    var rotateYMatrix = mat4.create();

    var sceneUniformData = new Float32Array(24);
    sceneUniformData.set(viewProjMatrix);
    sceneUniformData.set(eyePosition, 16);
    sceneUniformData.set(lightPosition, 20);

    var sceneUniformBuffer = gl.createBuffer();
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, sceneUniformBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, sceneUniformData, gl.STATIC_DRAW);

    var assistCamUniformData = new Float32Array(24);
    assistCamUniformData.set(viewProjMatrixAssistCam);
    assistCamUniformData.set(eyePositionAssistCam, 16);
    assistCamUniformData.set(lightPosition, 20);

    var assistCamUniformBuffer = gl.createBuffer();
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, assistCamUniformBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, assistCamUniformData, gl.STATIC_DRAW);

    //////////////////////////
    // DEPTH SORT FUNCTION
    //////////////////////////

    var sortPositionA = vec4.create();
    var sortPositionB = vec4.create();
    var sortModelView = mat4.create();

    function depthSort(a, b) {
        vec4.set(sortPositionA, a.translate[0], a.translate[1], a.translate[2], 1.0);
        vec4.set(sortPositionB, b.translate[0], b.translate[1], b.translate[2], 1.0);

        mat4.mul(sortModelView, viewMatrix, a.modelMatrix);
        vec4.transformMat4(sortPositionA, sortPositionA, sortModelView);
        mat4.mul(sortModelView, viewMatrix, b.modelMatrix);
        vec4.transformMat4(sortPositionB, sortPositionB, sortModelView);

        return sortPositionB[2] - sortPositionA[2];
    }

    /////////////////
    // LOAD TEXTURE
    /////////////////

    var image = new Image();
    var firstFrame = true;
    var occludedSpheres = 0;

    image.onload = function() {
        var texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        var levels = Math.floor(Math.log2(Math.max(this.width, this.height))) + 1;
        gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, image.width, image.height);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, image.width, image.height, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.useProgram(program);
        gl.uniform1i(drawTexLocation, 0);
        gl.useProgram(null);

        var rotationMatrix = mat4.create();
        var rotationMatrix2 = mat4.create();
        var sphere, boundingBox;
        var samplesPassed;

        var i;

        function draw() {
            occludedSpheres = 0;

            // Note: Sort based on previous frame's transformations
            // if (occlusionCullingEnabled) {
            spheres.sort(depthSort);
            // }

            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(.9, .5, .3, 1);
            gl.enable(gl.DEPTH_TEST);
            gl.colorMask(true, true, true, true);
            gl.depthMask(true);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            for (i = 0; i < NUM_SPHERES; ++i) {
                sphere = spheres[i];
                boundingBox = sphere.boundingBox;

                // Update transforms
                sphere.rotate[1] += 0.003;
                sphere.rotate[2] += 0.003;

                utils.xformMatrix(sphere.modelMatrix, sphere.translate, null, sphere.scale);
                mat4.fromXRotation(rotationMatrix, sphere.rotate[2]);
                // mat4.fromYRotation(rotationMatrix2, sphere.rotate[1]);
                mat4.multiply(sphere.modelMatrix, rotationMatrix, sphere.modelMatrix);

                //////////////////
                // OCCLUSION TEST
                //////////////////

                // if (occlusionCullingEnabled) {

                    gl.colorMask(false, false, false, false);
                    gl.depthMask(false);
                    gl.useProgram(boundingBoxProgram);
                    gl.bindVertexArray(sphere.boundingBoxVertexArray);
                    gl.uniformMatrix4fv(boundingBoxModelMatrixLocation, false, sphere.modelMatrix);

                    // Check query results here (will be from previous frame or earlier)
                    if (sphere.queryInProgress && gl.getQueryParameter(sphere.query, gl.QUERY_RESULT_AVAILABLE)) {
                        sphere.occluded = !gl.getQueryParameter(sphere.query, gl.QUERY_RESULT);
                        if (sphere.occluded) {
                            occludedSpheres++;
                        }
                        sphere.queryInProgress = false;
                    }

                    // Query is initiated here by drawing the bounding box of the sphere
                    if (!sphere.queryInProgress) {
                        gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, sphere.query);
                        gl.drawArrays(gl.TRIANGLES, 0, sphere.boundingBoxNumVertices);
                        gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
                        sphere.queryInProgress = true;
                    }

                // } else {
                //     sphere.occluded = false;
                // }


                if (!sphere.occluded) {
                    gl.colorMask(true, true, true, true);
                    gl.depthMask(true);
                    gl.useProgram(program);
                    gl.bindVertexArray(sphere.vertexArray);

                    gl.uniformMatrix4fv(drawModelMatrixLocation, false, sphere.modelMatrix);

                    gl.drawElements(gl.TRIANGLES, sphere.numElements, gl.UNSIGNED_SHORT, 0);
                }
            }

            // Draw HUD (visualize occlusion results)
            if (showHUD) {
                gl.viewport(hudViewport[0], hudViewport[1], hudViewport[2], hudViewport[3]);
                gl.enable(gl.BLEND);
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(hudViewport[0], hudViewport[1], hudViewport[2], hudViewport[3]);
                gl.colorMask(true, true, true, true);
                gl.depthMask(true);
                gl.disable(gl.DEPTH_TEST);
                gl.clearColor(0.3, 0.5, 0.6, 1);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                gl.useProgram(hudProgram);
                for (i = 0; i < NUM_SPHERES; ++i) {
                    sphere = spheres[i];
                    if (!sphere.occluded) {
                        gl.bindVertexArray(sphere.vertexArray);
                        gl.uniformMatrix4fv(hudModelMatrixLocation, false, sphere.modelMatrix);
                        gl.drawElements(gl.TRIANGLES, sphere.numElements, gl.UNSIGNED_SHORT, 0);
                    } else {
                        // gl.bindVertexArray(sphere.vertexArray);
                        // gl.uniformMatrix4fv(hudModelMatrixLocation, false, sphere.modelMatrix);
                        // gl.drawElements(gl.TRIANGLES, sphere.numElements, gl.UNSIGNED_SHORT, 0);
                    }
                }
                gl.disable(gl.SCISSOR_TEST);
                gl.disable(gl.BLEND);
            }

            occludedSpheresElement.innerHTML = occludedSpheres;

            requestAnimationFrame(draw);
        }

        requestAnimationFrame(draw);

    }

    image.src = "img/pandy.jpg";
}
