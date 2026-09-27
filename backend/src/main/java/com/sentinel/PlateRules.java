package com.sentinel;

import java.util.*;
import java.util.regex.Pattern;
import static com.sentinel.Models.*;

public final class PlateRules {
    private PlateRules() {}
    private static final Pattern CANDIDATE = Pattern.compile("\\b(?:[A-Z]{2}[\\s-]*\\d{1,2}[\\s-]*[A-Z]{1,3}[\\s-]*\\d{4}|\\d{2}[\\s-]*BH[\\s-]*\\d{4}[\\s-]*[A-Z]{1,2})\\b");
    public static String normalize(String value) { return value == null ? "" : value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", ""); }
    public static boolean valid(String value) { return value != null && value.matches("[A-Z0-9]{5,12}") && value.matches(".*[A-Z].*") && value.matches(".*[0-9].*"); }
    public static String reliablePlate(String text, double confidence, int minimum) {
        Set<String> plates = new LinkedHashSet<>();
        var matcher = CANDIDATE.matcher(text.toUpperCase(Locale.ROOT));
        while (matcher.find()) plates.add(normalize(matcher.group()));
        return Double.isFinite(confidence) && confidence >= minimum && plates.size() == 1 ? plates.iterator().next() : null;
    }
    public static int distance(String a, String b) {
        int[] previous = new int[b.length()+1];
        for (int j=0;j<=b.length();j++) previous[j]=j;
        for (int i=1;i<=a.length();i++) {
            int[] current = new int[b.length()+1]; current[0]=i;
            for (int j=1;j<=b.length();j++) current[j]=Math.min(Math.min(current[j-1]+1, previous[j]+1), previous[j-1]+(a.charAt(i-1)==b.charAt(j-1)?0:1));
            previous=current;
        }
        return previous[b.length()];
    }
    public static double similarity(String a,String b) { return a.isEmpty() || b.isEmpty() ? 0 : (1-(double)distance(a,b)/Math.max(a.length(),b.length()))*100; }
    private record Match(Vehicle vehicle,double score,int distance) {}
    public static Decision evaluate(String plate, List<Vehicle> vehicles,int threshold,int previousDenied,int previousScans) {
        if (!valid(plate) || threshold<1 || threshold>100) throw new IllegalArgumentException("Invalid scan");
        var ranked = vehicles.stream().map(v -> new Match(v,similarity(plate,v.plate_number()),distance(plate,v.plate_number())))
            .sorted(Comparator.comparingDouble(Match::score).reversed().thenComparing(m -> m.vehicle().plate_number())).toList();
        Match best=ranked.isEmpty()?null:ranked.getFirst();
        double score=best==null?0:best.score();
        boolean ambiguous=ranked.size()>1 && Math.abs(score-ranked.get(1).score())<1e-9;
        String decision="DENIED", reason;
        if(best==null) reason="No registered vehicles are available for comparison.";
        else if(score<threshold) reason=String.format(Locale.ROOT,"Best match %.1f%% is below the %d%% threshold.",score,threshold);
        else if(ambiguous) reason="Multiple vehicles share the best score. Manual verification is required.";
        else if(!best.vehicle().status().equals("ACTIVE")) reason=String.format(Locale.ROOT,"Vehicle matched at %.1f%%, but is %s.",score,best.vehicle().status());
        else { decision="GRANTED"; reason=String.format(Locale.ROOT,"Active vehicle matched at %.1f%%, meeting the %d%% threshold.",score,threshold); }
        String risk="LOW"; List<String> reasons=new ArrayList<>();
        if(decision.equals("DENIED") || previousDenied>=3) {
            risk="HIGH"; if(decision.equals("DENIED")) reasons.add(reason);
            if(previousDenied>=3) reasons.add(previousDenied+" denied attempts for this exact detected plate in the last 24 hours.");
        } else if(score<85 || previousDenied>0 || previousScans>=3) {
            risk="MEDIUM";
            if(score<85) reasons.add("Similarity is below the strong-match level of 85%.");
            if(previousDenied>0) reasons.add(previousDenied+" previous denied attempts in 24 hours.");
            if(previousScans>=3) reasons.add(previousScans+" previous scans in 24 hours.");
        } else reasons.add("Strong match, active registration, and no recent denied attempts.");
        return new Decision(best==null?null:best.vehicle().plate_number(),best==null?null:best.vehicle().status(),score,best==null?null:best.distance(),threshold,decision,reason,risk,reasons,previousScans,previousDenied);
    }
}
