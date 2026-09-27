package com.sentinel;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounds actual bytes, including chunked requests, before JSON materialization. */
final class RequestSizeFilter extends OncePerRequestFilter {
    static final int LIMIT=7_100_000;
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        if (!request.getMethod().equals("POST") && !request.getMethod().equals("PUT")) { chain.doFilter(request,response); return; }
        byte[] bytes=request.getInputStream().readNBytes(LIMIT+1);
        if(bytes.length>LIMIT) {
            response.setStatus(413); response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"BODY_SIZE\",\"error\":\"The request is too large. Images must be smaller than 5 MB.\"}"); return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public ServletInputStream getInputStream() {
                var input=new ByteArrayInputStream(bytes);
                return new ServletInputStream() {
                    public int read() { return input.read(); }
                    public boolean isFinished() { return input.available()==0; }
                    public boolean isReady() { return true; }
                    public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                };
            }
            @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(),java.nio.charset.StandardCharsets.UTF_8)); }
        },response);
    }
}
