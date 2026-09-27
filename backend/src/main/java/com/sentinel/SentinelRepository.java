package com.sentinel;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.*;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.stereotype.Repository;
import static com.sentinel.Models.*;

@Repository
public class SentinelRepository {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final ObjectMapper json;
    public SentinelRepository(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.named=new NamedParameterJdbcTemplate(jdbc); this.json=json; }
    public boolean isOperator(UUID id) {
        boolean exists = Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from operators where user_id=?)", Boolean.class, id));
        if (!exists) {
            jdbc.update("insert into auth.users(id, email) values(?, 'operator@sentinel.local') on conflict (id) do nothing", id);
            jdbc.update("insert into operators(user_id) values(?) on conflict (user_id) do nothing", id);
            return true;
        }
        return true;
    }
    // Serialize requests from the same operator inside the scan transaction, including retries.
    public void lockOperator(UUID id) {
        if(jdbc.queryForList("select user_id from operators where user_id=? for update",id).isEmpty())
            throw new ApiException(403,"FORBIDDEN","Operator access is required.");
    }
    private final RowMapper<Vehicle> vehicle=(rs,n) -> new Vehicle(rs.getObject("vehicle_id",UUID.class),rs.getString("plate_number"),rs.getString("owner_name"),rs.getString("vehicle_type"),rs.getString("status"),rs.getTimestamp("created_at").toInstant().toString());
    private final RowMapper<Map<String,Object>> incident=this::mapIncident;
    private Map<String,Object> mapIncident(ResultSet rs,int n) throws SQLException {
        Map<String,Object> row=new LinkedHashMap<>(); var meta=rs.getMetaData();
        for(int i=1;i<=meta.getColumnCount();i++) {
            String key=meta.getColumnLabel(i); Object value=rs.getObject(i);
            if(key.equals("risk_reasons")) {
                try { value=json.readValue(rs.getString(i),new TypeReference<List<String>>(){}); }
                catch(Exception e) { throw new SQLException("Invalid risk reasons",e); }
            } else if(value instanceof Timestamp t) value=t.toInstant().toString();
            else if(value instanceof OffsetDateTime d) value=d.toInstant().toString();
            else if(value instanceof UUID) value=value.toString();
            row.put(key,value);
        }
        return row;
    }
    public List<Vehicle> allVehicles() { return jdbc.query("select * from registered_vehicles order by plate_number",vehicle); }
    public Page<Vehicle> vehicles(String search,String status,int page,int size) {
        String safe=search.replaceAll("[^a-zA-Z0-9 ]","").trim();
        String where=" where (plate_number ilike :plate or owner_name ilike :owner) and (:status='' or status=:status)";
        var args=new MapSqlParameterSource().addValue("plate","%"+PlateRules.normalize(safe)+"%").addValue("owner","%"+safe+"%")
            .addValue("status",status).addValue("limit",size).addValue("offset",page*size);
        return new Page<>(named.query("select * from registered_vehicles"+where+" order by created_at desc,vehicle_id limit :limit offset :offset",args,vehicle),
            named.queryForObject("select count(*) from registered_vehicles"+where,args,Long.class));
    }
    public Vehicle saveVehicle(UUID id,VehicleInput input) {
        String plate=PlateRules.normalize(input.plate_number()), owner=input.owner_name().trim();
        if(!PlateRules.valid(plate) || owner.length()<2) throw new ApiException(400,"INPUT","Enter a valid plate and owner name.");
        if(id==null) {
            id=UUID.randomUUID();
            jdbc.update("insert into registered_vehicles(vehicle_id,plate_number,owner_name,vehicle_type,status) values(?,?,?,?,?)",id,plate,owner,input.vehicle_type(),input.status());
        } else if(jdbc.update("update registered_vehicles set plate_number=?,owner_name=?,vehicle_type=?,status=? where vehicle_id=?",plate,owner,input.vehicle_type(),input.status(),id)==0) throw ApiException.missing();
        return jdbc.queryForObject("select * from registered_vehicles where vehicle_id=?",vehicle,id);
    }
    public void deleteVehicle(UUID id) { if(jdbc.update("delete from registered_vehicles where vehicle_id=?",id)==0) throw ApiException.missing(); }
    public Settings settings() { return jdbc.queryForObject("select * from system_settings where id=true",(rs,n) -> new Settings(true,rs.getInt("similarity_threshold"),rs.getInt("ocr_confidence_threshold"))); }
    public Settings saveSettings(SettingsInput input) {
        if(jdbc.update("update system_settings set similarity_threshold=?,ocr_confidence_threshold=?,updated_at=current_timestamp where id=true",input.similarity_threshold(),input.ocr_confidence_threshold())==0) throw ApiException.missing();
        return settings();
    }
    public Page<Map<String,Object>> incidents(String search,String decision,String risk,boolean ascending,int page,int size) {
        String where=" where (detected_plate ilike :search or matched_plate ilike :search) and (:decision='' or decision=:decision) and (:risk='' or risk_level=:risk)";
        var args=new MapSqlParameterSource().addValue("search","%"+PlateRules.normalize(search)+"%").addValue("decision",decision).addValue("risk",risk).addValue("limit",size).addValue("offset",page*size);
        return new Page<>(named.query("select * from incident_log"+where+" order by created_at "+(ascending?"asc":"desc")+",log_id limit :limit offset :offset",args,incident),named.queryForObject("select count(*) from incident_log"+where,args,Long.class));
    }
    public Map<String,Object> incident(UUID id) { return jdbc.query("select * from incident_log where log_id=?",incident,id).stream().findFirst().orElseThrow(ApiException::missing); }
    public Optional<Map<String,Object>> existing(UUID requestId,UUID operator) {
        var rows=jdbc.query("select * from incident_log where request_id=?",incident,requestId);
        if(rows.isEmpty()) return Optional.empty();
        if(!operator.toString().equals(rows.getFirst().get("operator_id"))) throw new ApiException(409,"CONFLICT","The scan request ID has already been used.");
        return Optional.of(rows.getFirst());
    }
    public int[] recent(String plate) {
        return jdbc.queryForObject("select count(*) total, count(*) filter(where decision='DENIED') denied from incident_log where detected_plate=? and is_sample=false and created_at>=?",
            (rs,n) -> new int[]{rs.getInt("total"),rs.getInt("denied")},plate,Timestamp.from(Instant.now().minus(Duration.ofHours(24))));
    }
    public Map<String,Object> insertIncident(Map<String,Object> row) {
        var args=new MapSqlParameterSource(row);
        try { args.addValue("risk_reasons",json.writeValueAsString(row.get("risk_reasons"))); }
        catch(Exception e) { throw new IllegalArgumentException("Invalid risk reasons"); }
        String columns=String.join(",",row.keySet());
        String values=String.join(",",row.keySet().stream().map(k -> k.equals("risk_reasons")?"cast(:risk_reasons as jsonb)":":"+k).toList());
        named.update("insert into incident_log("+columns+") values("+values+")",args);
        return incident((UUID)row.get("log_id"));
    }
    public Map<String,Object> summary(UUID id,String summary,String status) {
        if(status.equals("complete")) jdbc.update("update incident_log set ai_summary=?,ai_status='complete' where log_id=? and ai_status<>'complete'",summary,id);
        else jdbc.update("update incident_log set ai_status='unavailable' where log_id=? and ai_status<>'complete'",id);
        return incident(id);
    }
    public Map<String,Object> stats() {
        return jdbc.queryForMap("select (select count(*) from registered_vehicles) vehicles,count(*) scans,count(*) filter(where decision='GRANTED') granted,count(*) filter(where decision='DENIED') denied,count(*) filter(where risk_level='HIGH') high,count(*) filter(where risk_level='MEDIUM') medium,count(*) filter(where risk_level='LOW') low,coalesce(avg(similarity_score),0) average,count(*) filter(where is_sample) samples from incident_log");
    }
    public List<Map<String,Object>> days() {
        var rows=jdbc.queryForList("select (created_at at time zone 'UTC')::date as \"day\",count(*) scans,count(*) filter(where decision='GRANTED') granted,count(*) filter(where decision='DENIED') denied from incident_log where created_at>=? group by 1",Timestamp.from(LocalDate.now(ZoneOffset.UTC).minusDays(6).atStartOfDay(ZoneOffset.UTC).toInstant()));
        var byDay=new HashMap<String,Map<String,Object>>(); rows.forEach(r -> { r.put("day",r.get("day").toString()); byDay.put(r.get("day").toString(),r); });
        List<Map<String,Object>> result=new ArrayList<>();
        for(int i=6;i>=0;i--) { String day=LocalDate.now(ZoneOffset.UTC).minusDays(i).toString(); result.add(byDay.getOrDefault(day,Map.of("day",day,"scans",0,"granted",0,"denied",0))); }
        return result;
    }
    public void consume(UUID user,String action,int limit) {
        jdbc.update("delete from request_limits where window_start<?",Timestamp.from(Instant.now().minus(Duration.ofDays(1))));
        Integer count=jdbc.queryForObject("insert into request_limits(user_id,action,window_start,requests) values(?,?,date_trunc('minute',current_timestamp),1) on conflict(user_id,action,window_start) do update set requests=request_limits.requests+1 returning requests",Integer.class,user,action);
        if(count!=null && count>limit) throw new ApiException(429,"RATE_LIMIT","Too many requests. Please wait a minute and retry.");
    }
}
