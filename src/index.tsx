import { Context, Schema, Time, Session, Fragment } from 'koishi'
import { } from '@koishijs/plugin-rate-limit'

export const name = 'pixiv-rank'

export interface Config {
  apiUrl: string,
  superuser: string[],
  limitCount: number,
  timeOut: number,
}

export const Config: Schema<Config> = Schema.object({
  apiUrl: Schema.string().required()
  .description('HibiAPI地址,不要末尾的/'),
  superuser: Schema.array(String).description('超级用户的UID，可以看R18'),
  limitCount: Schema.number().default(5).description('限制搜索次数'),
  timeOut: Schema.number().default(15000).description('接收搜索结果序号时间(ms)'),
})

export const using = ['puppeteer'];

export function apply(ctx: Context,cfg: Config) {
  // write your plugin here
  const viaR18 = cfg.superuser;
  ctx.command('pixiv/rank <word:text>','查看pixiv排行榜').alias('p站排行')
  .option('page', '-p [page:number] 张数')
  .option('next', '-n [page:number] 页面数')
  .example('rank -p 2 月榜')
  .action(async ({session,options}, word)=>{
    var apiurl:string = cfg.apiUrl+'/api/pixiv/rank'
    let next = options.next && options.next>=1? options.next:1;
    switch(word) {
      case '日榜': var getJson = await ctx.http.get(apiurl+`?mode=day&page=${next}`); break;
      case '周榜': var getJson = await ctx.http.get(apiurl+`?mode=week&page=${next}`); break;
      case '月榜': var getJson = await ctx.http.get(apiurl+`?mode=month&page=${next}`); break;
      case '男性向': var getJson = await ctx.http.get(apiurl+`?mode=day_male&page=${next}`); break;
      case '女性向': var getJson = await ctx.http.get(apiurl+`?mode=day_female&page=${next}`); break;
      case '原创榜': var getJson = await ctx.http.get(apiurl+`?mode=week_original&page=${next}`); break;
      default: return <>
      以下可选: &#10;
      日榜&#10;
      周榜&#10;
      月榜&#10;
      男性向(日榜)&#10;
      女性向(日榜)&#10;
      原创榜(周榜)
      </>
    }
    let ill_arr:any;
    let page = (options.page)? options.page:0;
    let full_page = getJson.illusts.length
    ill_arr = getJson.illusts[page];
    var original_image_url = ill_arr.meta_single_page.original_image_url? String(ill_arr.meta_single_page.original_image_url):String(ill_arr.meta_pages[0].image_urls.original)
    return <message forward>
      <author user-id={session.selfId} nickname={session.bot.username} avatar={session.bot.avatar}/>
      pid: {ill_arr.id}&#10;
      uid: {ill_arr.user.id}&#10;
      作者: {ill_arr.user.name}&#10;
      标题: {ill_arr.title}&#10;
      <image url={String(ill_arr.image_urls.medium).replace('i.pximg.net','i.pixiv.re')} />&#10;
      url: {original_image_url.replace('i.pximg.net','i.pixiv.re')}&#10;
      作品页面: {`https://www.pixiv.net/artworks/${ill_arr.id}`}&#10;
      Page: ({page}/{full_page})
    </message>
  })
  ctx.command('pixiv/search <word:text>','p站搜索').alias('p站搜索')
  .option('next', '-n [page:number] 搜索页页数')
  .action(async ({session,options},word)=>{
    let page = options.next? options.next:1;
    if (!word) return <>请输入有效关键词</>
    else {
      var getJson = await ctx.http.get(`${cfg.apiUrl}/api/pixiv/search?word=${word}&page=${page}`);
      var getTitleArr = [];
      var getAuthorArr = [];
      var getTags = [];
      let r18Arr = [];
      for (var i=0;getJson.illusts[i];i++) {
        getTitleArr[i] = getJson.illusts[i].title;
        getAuthorArr[i] = getJson.illusts[i].user.name? getJson.illusts[i].user.name:'undefined';
        getTags[i] = getJson.illusts[i].tags;
      }
      session.send(<message forward>
      <author user-id={session.selfId} nickname={session.bot.username} avatar={session.bot.avatar}/>
      <p>请选择序号,'$'结束搜索,最多{cfg.limitCount}次&#10;</p>
      {getTitleArr.map((elm,idx) => {return <p>{idx}| Title:{elm}, user:{getAuthorArr[idx]},
      tags:{getTags[idx].map((elm)=> {if(elm.name.includes('R-18') || elm.name.includes('R18') || elm.name.includes('r-18') || elm.name.includes('r18')) r18Arr.push(idx); return elm.translated_name? elm.translated_name:elm.name}).join(', ')}&#10;</p>})}
      </message>)
      var loop=true;
      var loopTime = 0;
      while(loop && loopTime<cfg.limitCount) {
        var num = await session.prompt(cfg.timeOut);
        if (!num) return <>输入超时，自动退出搜索!</>;
        if (num == "$") return <>搜索结束，感谢使用!</>;
        if (i - Number(num) <=1 ||  Number(num) < 0)  return <>请输入有效序列号</>
        else {
          if (viaR18.includes(session.userId) && r18Arr.includes(Number(num))) {
            if (session.isDirect) {
              await session.send(parseResult(Number(num),getJson));
            }
            else {
              await session.send('涩涩打咩！');
              await botWaitSendPrivate(session,1000,parseResult(Number(num),getJson));
            }
          }
          else if (r18Arr.includes(Number(num)))
            session.send(<>不可以涩涩哦~</>);
          else
            await session.send(<message forward>
            <author user-id={session.selfId} nickname={session.bot.username} avatar={session.bot.avatar}/>
              {parseResult(Number(num),getJson)}
            </message>)
        }
        loopTime++;
      }
      return <>搜索次数已达上限,结束搜索!</>
    }
  })
}

function parseResult(page: number, getJson: any) {
  let ill_arr:any;
  let full_page = getJson.illusts.length
  ill_arr = getJson.illusts[page];
  var original_image_url = ill_arr.meta_single_page.original_image_url? String(ill_arr.meta_single_page.original_image_url):String(ill_arr.meta_pages[0].image_urls.original)
  return <>
  pid: {ill_arr.id}&#10;
  uid: {ill_arr.user.id}&#10;
  作者: {ill_arr.user.name}&#10;
  标题: {ill_arr.title}&#10;
  <image url={String(ill_arr.image_urls.medium).replace('i.pximg.net','i.pixiv.re')} />&#10;
  url: {original_image_url.replace('i.pximg.net','i.pixiv.re')}&#10;
  作品页面: {`https://www.pixiv.net/artworks/${ill_arr.id}`}&#10;
  当前第({page}/{full_page})个结果
  </>
}

async function botWaitSendPrivate(session:Session, time:number, content:Fragment) {
  return new Promise(resolve => setTimeout(() => {
    session.bot.sendPrivateMessage(session.userId,content);
  }
  , time));
}
