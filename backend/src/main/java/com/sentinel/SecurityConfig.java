package com.sentinel;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DefaultOAuth2AuthenticatedPrincipal;
import org.springframework.security.oauth2.server.resource.introspection.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.cors.*;

@Configuration
public class SecurityConfig {
    @Bean HttpClient providerHttpClient() { return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build(); }

    // Supabase validates tokens remotely, supporting both legacy HS256 and rotated asymmetric signing keys.
    @Bean OpaqueTokenIntrospector introspector(HttpClient http, ObjectMapper json, SentinelRepository repository,
        @Value("${sentinel.supabase-url}") String url, @Value("${sentinel.supabase-anon-key}") String key) {
        return token -> {
            try {
                if (key.isBlank()) throw new OAuth2IntrospectionException("Authentication is not configured");
                var request=HttpRequest.newBuilder(URI.create(url+"/auth/v1/user")).timeout(Duration.ofSeconds(10))
                    .header("apikey",key.trim()).header("Authorization","Bearer "+token).GET().build();
                var response=http.send(request,HttpResponse.BodyHandlers.ofString());
                if(response.statusCode()==401 || response.statusCode()==403) throw new BadOpaqueTokenException("Invalid session");
                if(response.statusCode()!=200) throw new OAuth2IntrospectionException("Authentication unavailable");
                var user=json.readTree(response.body());
                UUID id=UUID.fromString(user.path("id").asText());
                boolean operator=repository.isOperator(id);
                return new DefaultOAuth2AuthenticatedPrincipal(id.toString(),Map.of("sub",id.toString(),"operator",operator),
                    operator?List.of(new SimpleGrantedAuthority("ROLE_OPERATOR")):List.of());
            } catch(BadOpaqueTokenException e) { throw e; }
            catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new OAuth2IntrospectionException("Authentication unavailable"); }
            catch(Exception e) { e.printStackTrace(); throw new OAuth2IntrospectionException("Authentication unavailable: " + e.getMessage(), e); }
        };
    }

    @Bean SecurityFilterChain security(HttpSecurity http, OpaqueTokenIntrospector introspector,
        @Value("${sentinel.allowed-origins}") String origins) throws Exception {
        var cors=new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).toList());
        cors.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization","Content-Type"));
        cors.setMaxAge(3600L);
        var source=new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/api/**",cors);
        http.csrf(c -> c.disable()).cors(c -> c.configurationSource(source))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a.requestMatchers(HttpMethod.GET,"/api/health").permitAll()
                .requestMatchers("/api/me").authenticated().requestMatchers("/api/**").hasRole("OPERATOR").anyRequest().denyAll())
            .oauth2ResourceServer(o -> o.opaqueToken(t -> t.introspector(introspector))
                .authenticationEntryPoint((req,res,e) -> {
                    res.setStatus(401); res.setContentType("application/json");
                    res.getWriter().write("{\"code\":\"AUTH\",\"error\":\"Sign in again, or check the backend authentication configuration.\"}");
                }))
            .exceptionHandling(e -> e.accessDeniedHandler((req,res,ex) -> {
                res.setStatus(403); res.setContentType("application/json");
                res.getWriter().write("{\"code\":\"FORBIDDEN\",\"error\":\"Operator access is required.\"}");
            }))
            .addFilterAfter(new RequestSizeFilter(), AuthorizationFilter.class);
        return http.build();
    }
}
