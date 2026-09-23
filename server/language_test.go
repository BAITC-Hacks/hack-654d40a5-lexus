package main

import "testing"

func TestLanguageAuditIsConservative(t *testing.T){
 cases:=[]struct{name,text,locale string;warning bool}{
  {"Russian with technical terms","Мы создаём приложение на React и TypeScript. Backend использует Go, PostgreSQL, Docker и REST API. Нужен удобный интерфейс для клиентов компании.","ru",false},
  {"Technical stack only","React TypeScript Go Docker PostgreSQL REST API CI CD OpenAI Python GitHub SQL JWT OAuth","ru",false},
  {"Short foreign name","Pixel Pioneers Data Lab","ru",false},
  {"English paragraph","We need a simple application to help customers schedule appointments and manage their daily orders in a local coffee shop.","ru",true},
  {"English task","We need a simple application to help customers schedule appointments and manage their daily orders in a local coffee shop.","en",false},
  {"Kazakh paragraph","Бізге оқушыларға арналған ыңғайлы қосымша қажет. Мұғалімдер тапсырмаларды оқушыларға жіберіп, олардың нәтижелерін көре алуы керек.","ru",true},
  {"URLs and code","В проекте нужно использовать API https://example.org/foreign-url и почту person@example.org. Все материалы будут доступны команде после согласования. `const value = await fetch(url)`","ru",false},
  {"Mixed names in Russian","Компания Green Step предлагает создать сервис для жителей города. Пользователи смогут находить доступные места и отмечать удобные маршруты.","ru",false},
 }
 for _,c:=range cases{t.Run(c.name,func(t *testing.T){a:=auditLanguage(c.text,c.locale);if a.Warning!=c.warning{t.Fatalf("got %+v want warning=%v",a,c.warning)}})}
}
func TestLanguagePenaltyRequiresAcknowledgementAndRecovers(t *testing.T){
 f:=Fields{};approved:=map[string]string{};for _,k:=range fieldKeys {f[k]="Подтверждённое описание задачи";approved[k]=hash(f[k])}
 c:=Challenge{ID:"test",Fields:f,Approved:approved,Locale:"ru",Revision:1}
 s:=State{}
 if err:=publish(&s,&c,"original");err!=nil{t.Fatal(err)}
 if c.Score!=100{t.Fatal(c.Score)}
 c.Fields["need"]="We need a simple application to help customers schedule appointments and manage their daily orders in a local coffee shop."
 c.Approved["need"]=hash(c.Fields["need"])
 if err:=publish(&s,&c,"unacknowledged");err==nil{t.Fatal("unacknowledged language discrepancy was published")}
 syncLanguage(&c,&s,true)
 if err:=publish(&s,&c,"acknowledged");err!=nil{t.Fatal(err)}
 if c.Score!=95||c.LanguagePenalty!=5{t.Fatalf("score=%d penalty=%d",c.Score,c.LanguagePenalty)}
 c.Fields["need"]+=" New requirements.";syncLanguage(&c,&s,false)
 if c.LanguageAcknowledged!=""{t.Fatal("edited text must invalidate acknowledgement")}
 c.Fields["need"]="Нужно приложение для клиентов кофейни, чтобы они могли заранее заказывать напитки и отслеживать готовность заказа.";c.Approved["need"]=hash(c.Fields["need"])
 if err:=publish(&s,&c,"corrected");err!=nil{t.Fatal(err)}
 if c.Score!=100||c.LanguagePenalty!=0{t.Fatal("correcting language must restore readiness")}
 if c.Versions[1].Score!=95||c.Versions[1].LanguagePenalty!=5{t.Fatal("historical language penalty must remain immutable")}
}
func TestFileLocaleCannotBypassTaskAudit(t *testing.T){
 foreign:=auditLanguage("We need a simple application to help customers schedule appointments and manage their daily orders in a local coffee shop.","en")
 if foreign.Warning{t.Fatal("English expected")}
 s:=State{Attachments:[]Attachment{{ID:"file",Audit:foreign}}}
 c:=Challenge{Locale:"ru",AttachmentIDs:[]string{"file"},Fields:Fields{"need":"Нужна понятная задача"}}
 if !challengeLanguage(&c,&s).Warning{t.Fatal("file audit must be evaluated against the task language")}
}
