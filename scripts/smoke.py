#!/usr/bin/env python3
"""Integration checks against a running DEMO instance. Creates one isolated test quest."""
import json, urllib.request, urllib.error, http.cookiejar, uuid, os
BASE=os.environ.get('SANA_URL','http://localhost:8081')
class Client:
    def __init__(self,profile=None):
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        if profile:self.call('/auth/login',{'email':{'b1':'business@alemhack.ai','b2':'pro@alemhack.ai','ut1':'student@alemhack.ai','admin':'admin@alemhack.ai'}[profile],'password':'Pass1234!'})
    def call(self,path,body=None,status=200):
        req=urllib.request.Request(BASE+'/api'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
        try:r=self.opener.open(req,timeout=120);code=r.status;value=json.load(r)
        except urllib.error.HTTPError as e:code=e.code;value=json.load(e)
        assert code==status,(path,code,status,value)
        return value
b=Client('b1');team=Client('ut1');other=Client('b2');anon=Client()
fields={'title':'QA '+uuid.uuid4().hex[:8],'need':'У кофейни остаётся выпечка к вечеру. Нужно сократить списания.'}
c=b.call('/challenges',{'fields':fields,'category':'Retail','locale':'ru','original':'Хочу понять, что делать с вечерними остатками выпечки.'})
assert c['activity'][0]['detail']=='Хочу понять, что делать с вечерними остатками выпечки.'
anon.call('/challenges',{'fields':fields,'category':'Retail','locale':'ru'},401)
other.call('/challenges/'+c['id'],{'revision':c['revision'],'fields':fields},403)
ai=b.call('/ai',{'source':fields['need'],'locale':'kk','local':True});assert len(ai['questions'])>=3 and ai['provider']=='local'
c=b.call('/challenges/'+c['id'],{'revision':c['revision'],'fields':fields,'confirm':['need']})
c=b.call('/challenges/'+c['id']+'/publish',{'revision':c['revision'],'previewApproved':True});assert c['score']==0
assert any(x['id']==c['id'] for x in anon.call('/bootstrap')['challenges'])
p=team.call('/proposals',{'challengeId':c['id'],'version':1,'idea':'Изучим текущий процесс и построим прогноз.','plan':'Интервью, анализ данных, прототип и проверка.','deadline':'21 день','link':'https://example.org/prototype'})
# Enrich and confirm all seven criteria.
for k,v in {'context':'Сотрудники вручную считают остатки по вечерам.','users':'Бариста и управляющий кофейней.','data':'Обезличенная таблица продаж за три месяца.','constraints':'21 день, локальный запуск, данные обезличены.','result':'Прототип прогноза и инструкция запуска.','success':'Снизить списания на 20 процентов на пилоте.','contact':'demo@example.org','interaction':'Созвон во вторник, обратная связь в течение двух дней.'}.items():fields[k]=v
old=c['revision'];c=b.call('/challenges/'+c['id'],{'revision':old,'fields':fields,'confirm':list(fields)});assert c['score']==100
b.call('/challenges/'+c['id'],{'revision':old,'fields':fields},409)
# Unpublished draft does not change public snapshot.
public=next(x for x in anon.call('/bootstrap')['challenges'] if x['id']==c['id']);assert public['score']==0
c=b.call('/challenges/'+c['id']+'/publish',{'revision':c['revision'],'previewApproved':True,'note':'Добавлены данные и измеримые критерии.'});assert c['versions'][0]['score']==0 and c['versions'][1]['score']==100
notices=team.call('/bootstrap')['notifications'];assert any(n['challengeId']==c['id'] and n['kind']=='changed' for n in notices)
advice=team.call('/changes',{'challengeId':c['id'],'version':2,'locale':'en'});assert len(advice['actions'])>=2 and 'data' in advice['fields']
assert team.call('/changes',{'challengeId':c['id'],'version':2,'locale':'en'})==advice
b.call('/proposals/'+p['id'],{'action':'accept'},409)
team.call('/proposals/'+p['id'],{'action':'reconfirm'})
b.call('/proposals/'+p['id'],{'action':'accept'})
team.call('/proposals/'+p['id'],{'action':'review','stars':5,'text':'Работа выполнена отлично.'},403)
b.call('/proposals/'+p['id'],{'action':'review','stars':5,'text':'Работа выполнена отлично.'},403)
initial=next(t for t in b.call('/bootstrap')['teams'] if t['id']=='t1')['xp']
b.call('/proposals/'+p['id'],{'action':'milestone'});b.call('/proposals/'+p['id'],{'action':'milestone'})
assert next(t for t in b.call('/bootstrap')['teams'] if t['id']=='t1')['xp']==initial+50
team.call('/proposals/'+p['id'],{'action':'submit','submission':'Рабочий прототип: https://example.org/final. Критерии проверены на пилоте.'})
b.call('/proposals/'+p['id'],{'action':'review','stars':5,'text':'Понятный прототип и полезная документация.'})
b.call('/proposals/'+p['id'],{'action':'review','stars':5,'text':'Повторный отзыв недопустим.'},403)
t=next(t for t in b.call('/bootstrap')['teams'] if t['id']=='t1');assert t['xp']==initial+200 and any(r['proposalId']==p['id'] for r in t['reviews'])
Client('admin').call('/admin/users',{'userId':'b1','role':'business','plan':'pro'});assert b.call('/bootstrap')['user']['plan']=='pro'
assert next(x for x in b.call('/bootstrap')['challenges'] if x['id']==c['id'])['score']==100
team.call('/media',{'challengeId':c['id'],'version':2,'script':'Not allowed to generate customer media','locale':'en','duration':30,'voice':'none','approved':True,'previewApproved':True},403)
print(json.dumps({'result':'PASS','checks':22,'challengeId':c['id'],'proposalId':p['id'],'finalScore':100,'teamXPDelta':200},ensure_ascii=False))
