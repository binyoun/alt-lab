// Minimal WebGL2 wrapper: one fullscreen quad, one program, uniform setting.

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export function createGL(canvas, fragSource) {
  const gl = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');

  const program = link(gl, VERT, fragSource);
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {};
  const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }

  const textures = {};
  let unitCount = 0;

  function setTexture(name, source) {
    let entry = textures[name];
    if (!entry) {
      entry = textures[name] = { tex: gl.createTexture(), unit: unitCount++ };
    }
    gl.activeTexture(gl.TEXTURE0 + entry.unit);
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (uniforms[name]) gl.uniform1i(uniforms[name], entry.unit);
  }

  function set(values) {
    for (const [name, v] of Object.entries(values)) {
      const u = uniforms[name];
      if (!u) continue;
      if (typeof v === 'number') gl.uniform1f(u, v);
      else if (v.length === 2) gl.uniform2f(u, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(u, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(u, v[0], v[1], v[2], v[3]);
    }
  }

  function setInt(name, v) {
    if (uniforms[name]) gl.uniform1i(uniforms[name], v);
  }

  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { gl, set, setInt, setTexture, draw };
}

function link(gl, vertSrc, fragSrc) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Shader link failed: ' + gl.getProgramInfoLog(program));
  }
  return program;
}

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
  }
  return shader;
}
