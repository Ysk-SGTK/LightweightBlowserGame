using System;

[Serializable] public class Product {
    public string name; public int cost,standard,baseDemand,maxDaily; public bool perishable;
    public Product(string n,int c,int s,int d,int max,bool p){name=n;cost=c;standard=s;baseDemand=d;maxDaily=max;perishable=p;}
}
[Serializable] public class DayReport {
    public int day,weather,revenue,purchases,soldCost,wasteCost,sold,waste,missed,priceRejected,profit,cash,electricity,shelfMissed;
    public int[] sales=new int[5],remaining=new int[5],wastes=new int[5],misses=new int[5],revenues=new int[5],rejections=new int[5],priceTiers=new int[5],shelfMisses=new int[5]; public bool[] soldOut=new bool[5];
    public ProductDayResult[] products; public int laborCost,staffCount; public ShopForecast forecast,singleStaffForecast; public string staffComment;
}
[Serializable] public class ProductDayResult {
    public int day,product_id,units_sold,revenue,waste_count,opportunity_loss_count,ending_stock;
    public bool sold_out; public int shelf_loss_count; public string comment;
}
[Serializable] public class ProductTotal { public int product_id,units_sold,revenue; }
public class ShopModel {
    public static readonly Product[] Products={new Product("おにぎり",85,160,24,40,true),new Product("弁当",270,620,14,26,true),new Product("飲料",70,160,22,45,false),new Product("お菓子",100,180,16,28,false),new Product("日用品",240,420,5,12,false)};
    public static readonly string[] WeatherNames={"ふつう","晴れ","暑い","雨","寒い"};
    public static readonly string[] Hints={"いつもの需要。昨日の売れ残りを見て仕入れよう。","人通りが少し増えそう。飲料もやや人気。","人通りが多く、飲料が人気。品出しも忙しくなりそう。","人通りは20%減。お菓子は少し人気。","おにぎり・弁当の需要が20%増。"};
    public static readonly float[] Rates={.8f,1f,1.2f,1.4f},Acceptance={1f,.88f,.64f,.36f};
    public int day=1,cash=30000,weather,totalRevenue,totalProfit,totalSold,totalWaste,totalMissed,totalPurchases,totalElectricity,totalLabor,twoStaffDays; public int staffCount=1; public const int BaseLabor=600,ExtraLabor=1500; public static int LaborCost(int count)=>BaseLabor+(count==2?ExtraLabor:0);
    public int[] stock=new int[5],order=new int[5],price=new[]{1,1,1,1,1},attempts=new int[5];
    public string state="Morning"; public DayReport report,last; Random random; int seed;
    public ShopModel(int s){seed=s;random=new Random(s);Weather();}
    void Weather(){weather=random.Next(5); for(int i=0;i<5;i++)order[i]=0;}
    public int SellingPrice(int i)=> (int)Math.Round(Products[i].standard*Rates[price[i]],MidpointRounding.AwayFromZero);
    public int OrderCost(){int n=0;for(int i=0;i<5;i++)n+=order[i]*Products[i].cost;return n;}
    public float Demand(int i){float traffic=weather==3?.8f:weather==1?1.08f:weather==2?1.35f:1f;float category=1f;if(i==2)category=weather==2?1.5f:weather==1?1.15f:weather==4?.75f:1f;if(weather==3&&i==3)category=1.2f;if(weather==4&&i<2)category=1.2f;return Products[i].baseDemand*traffic*category;}
    public bool Open(){if(state!="Morning"||OrderCost()>cash)return false;report=new DayReport{day=day,weather=weather,purchases=OrderCost(),staffCount=staffCount,laborCost=LaborCost(staffCount)};cash-=report.purchases;for(int i=0;i<5;i++){stock[i]+=order[i];attempts[i]=0;report.priceTiers[i]=price[i];}state="Open";return true;}
    // Candidate weights remain positive for empty shelves, so unmet demand remains visible.
    public int Candidate(){double sum=0;for(int i=0;i<5;i++)if(attempts[i]<Products[i].maxDaily)sum+=Demand(i)*( .7+.3*Acceptance[price[i]]);double roll=random.NextDouble()*sum;for(int i=0;i<5;i++){if(attempts[i]>=Products[i].maxDaily)continue;roll-=Demand(i)*(.7+.3*Acceptance[price[i]]);if(roll<=0){attempts[i]++;return i;}}return -1;}
    public int VisitCount(){float sum=0;for(int i=0;i<5;i++)sum+=Demand(i);return (int)Math.Round(sum*(.9+random.NextDouble()*.2));}
    // Shelf pickup tests availability; the cashier commits revenue separately.
    public int Decide(int i,bool shelfAvailable){if(state!="Open"||i<0||i>=5)return 0;if(random.NextDouble()>Acceptance[price[i]]){report.priceRejected++;report.rejections[i]++;return 0;}if(!shelfAvailable){report.missed++;report.misses[i]++;report.soldOut[i]=true;if(stock[i]>0){report.shelfMissed++;report.shelfMisses[i]++;}return -1;}return 1;}
    public void Checkout(int i){if(state!="Open"||stock[i]<=0)throw new InvalidOperationException("No reserved inventory to checkout");stock[i]--;int money=SellingPrice(i);cash+=money;report.revenue+=money;report.revenues[i]+=money;report.soldCost+=Products[i].cost;report.sold++;report.sales[i]++;}
    // Retained for economic balance tests, which do not simulate shelf logistics.
    public int Buy(int i){int result=Decide(i,stock[i]>0);if(result==1)Checkout(i);return result;}
    public void Close(int electricity=0){if(state!="Open")return;report.electricity=electricity;cash-=electricity+report.laborCost;report.products=new ProductDayResult[5];for(int i=0;i<5;i++){report.soldOut[i]|=stock[i]==0&&report.sales[i]>0;if(Products[i].perishable){report.wastes[i]=stock[i];report.waste+=stock[i];report.wasteCost+=stock[i]*Products[i].cost;stock[i]=0;}report.remaining[i]=stock[i];var row=new ProductDayResult{day=day,product_id=i,units_sold=report.sales[i],revenue=report.revenues[i],waste_count=report.wastes[i],opportunity_loss_count=report.misses[i],ending_stock=stock[i],sold_out=report.soldOut[i],shelf_loss_count=report.shelfMisses[i]};row.comment=Comment(row,report.priceTiers[i],report.rejections[i]);report.products[i]=row;}report.profit=report.revenue-report.soldCost-report.wasteCost-electricity-report.laborCost;report.cash=cash;totalRevenue+=report.revenue;totalProfit+=report.profit;totalPurchases+=report.purchases;totalSold+=report.sold;totalWaste+=report.waste;totalMissed+=report.missed;totalElectricity+=electricity;totalLabor+=report.laborCost;if(report.staffCount==2)twoStaffDays++;report.staffComment=StaffComment(report);last=report;state="Result";}
    public static string Comment(ProductDayResult r,int tier,int rejected){
        if(r.opportunity_loss_count>0&&(r.waste_count>0||r.ending_stock>0))return "在庫あり。棚補充が遅れた可能性";
        if(r.opportunity_loss_count>0&&r.ending_stock==0&&r.waste_count==0)return "需要に対して仕入れが不足しました";
        if(tier>=2&&rejected>=3&&r.units_sold<Products[r.product_id].baseDemand/2&&(r.ending_stock>0||r.waste_count>0))return "価格が高すぎる可能性があります";
        if(r.waste_count>0)return "仕入れ過多の可能性があります";
        if(r.sold_out)return "欠品あり。仕入れ・品出しを検討";
        if(r.ending_stock>Math.Max(3,r.units_sold))return "在庫が多く残っています";
        if(r.units_sold>0)return "よく売れました";
        return "販売なし。仕入れ・陳列を確認";
    }
    static string StaffComment(DayReport r){
        if(r.staffCount==1)return r.shelfMissed>0?"棚で買えない場面あり。仕入れ・配置・品出し負担を確認。":"店員1人で営業。人件費と販売機会を見比べよう。";
        if(r.singleStaffForecast==null)return "追加店員の人件費 "+ExtraLabor+"円を含む利益です。";
        if(r.profit>r.singleStaffForecast.profit.mean&&r.missed<r.singleStaffForecast.missed.mean)return "1人時の概算より利益増・欠品減。追加店員が貢献した可能性。";
        if(r.revenue-r.singleStaffForecast.revenue.mean<ExtraLabor)return "1人時の概算からの売上増が小さく、追加人件費が利益を圧迫した可能性。";
        return "2人で会計と品出しを分担。効果は1人時の概算との比較です。";
    }
    public void Next(){if(state!="Result")return;if(day==7){state="Final";return;}day++;Weather();state="Morning";}
    public int InventoryValue(){int value=0;for(int i=0;i<5;i++)value+=stock[i]*Products[i].cost;return value;}
}






