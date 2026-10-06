using System;
using System.Collections.Generic;

[Serializable] public class ForecastRange {
    public int low,high,mean;
    public static ForecastRange From(List<int> values){values.Sort();long sum=0;foreach(int n in values)sum+=n;return new ForecastRange{low=values[(int)((values.Count-1)*.1)],high=values[(int)Math.Ceiling((values.Count-1)*.9)],mean=(int)Math.Round(sum/(double)values.Count)};}
}
[Serializable] public class ProductForecast {
    public int product_id,planned_stock; public ForecastRange units,revenue,gross,remaining;
    public string shortageRisk,wasteRisk;
}
[Serializable] public class ShopForecast {
    public int samples,staffCount,purchases,labor,electricity;
    public ForecastRange revenue,gross,waste,profit,missed;
    public ProductForecast[] products;public string warning;
}
// Independent, fixed-seed samples reuse the actual walking, shelf and checkout model.
// They neither advance the live RNG nor inspect the upcoming day's random outcomes.
public static class ForecastCalculator {
    public static StoreSimulation Clone(StoreSimulation source,int seed,int staff=0){
        var m=new ShopModel(seed){day=source.model.day,weather=source.model.weather,cash=source.model.cash,staffCount=staff==0?source.model.staffCount:staff};
        Array.Copy(source.model.stock,m.stock,5);Array.Copy(source.model.order,m.order,5);Array.Copy(source.model.price,m.price,5);
        var sim=new StoreSimulation(m,seed);for(int i=0;i<sim.shelves.Length;i++){sim.shelves[i].slot=source.shelves[i].slot;sim.shelves[i].product=source.shelves[i].product;sim.shelves[i].capacity=source.shelves[i].capacity;sim.shelves[i].refrigerated=source.shelves[i].refrigerated;}return sim;
    }
    public static DayReport Run(StoreSimulation sim,float step=.08f){if(!sim.Open())throw new InvalidOperationException("Forecast order exceeds cash");int ticks=0;while(sim.model.state=="Open"&&ticks++<4000)sim.Tick(step);if(sim.model.state!="Result"||!sim.InventoryMatches())throw new InvalidOperationException("Forecast simulation did not close consistently");return sim.model.report;}
    public static ShopForecast Calculate(StoreSimulation source,int staff=0){
        const int count=24;var reports=new List<DayReport>();
        // Cash feasibility is shown separately. Forecast the plan even when it is over budget.
        for(int n=0;n<count;n++){var sim=Clone(source,17011+n*7919,staff);sim.model.cash=Math.Max(sim.model.cash,sim.model.OrderCost());reports.Add(Run(sim));}
        var f=new ShopForecast{samples=count,staffCount=staff==0?source.model.staffCount:staff,purchases=source.model.OrderCost(),electricity=source.Electricity(),products=new ProductForecast[5]};f.labor=ShopModel.LaborCost(f.staffCount);
        f.revenue=Range(reports,r=>r.revenue);f.gross=Range(reports,r=>r.revenue-r.soldCost);f.waste=Range(reports,r=>r.wasteCost);f.profit=Range(reports,r=>r.profit);f.missed=Range(reports,r=>r.missed);
        for(int i=0;i<5;i++){int p=i,missing=0,left=0;foreach(var r in reports){if(r.soldOut[i])missing++;if(r.wastes[i]>0)left++;}f.products[i]=new ProductForecast{product_id=i,planned_stock=source.model.stock[i]+source.model.order[i],units=Range(reports,r=>r.sales[p]),revenue=Range(reports,r=>r.revenues[p]),gross=Range(reports,r=>r.revenues[p]-r.sales[p]*ShopModel.Products[p].cost),remaining=Range(reports,r=>r.remaining[p]+r.wastes[p]),shortageRisk=Risk(missing,count),wasteRisk=ShopModel.Products[i].perishable?Risk(left,count):"対象外"};}
        f.warning=f.staffCount==1?"店員1人は品出し中にレジ待ちの可能性。予測は目安です。":"2人目は品出し担当。追加人件費を売上増で回収できるか確認。";
        for(int i=0;i<5;i++)if(f.products[i].shortageRisk=="高"){f.warning=ShopModel.Products[i].name+"は棚欠品の可能性。仕入れと配置を確認。予測は目安です。";break;}
        for(int i=0;i<5;i++)if(source.model.price[i]>=2){f.warning="高価格は販売数低下の可能性。予測はランダムな需要・来店順で上下します。";break;}
        return f;
    }
    static string Risk(int events,int count)=>events>=count*.6?"高":events>=count*.2?"中":"低";
    static ForecastRange Range(List<DayReport> reports,Func<DayReport,int> selector){var values=new List<int>();foreach(var r in reports)values.Add(selector(r));return ForecastRange.From(values);}
}
