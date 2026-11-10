from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from pathlib import Path
out=Path('docs/OSCAR四页面接口对接进度与支持事项.docx')
doc=Document(); sec=doc.sections[0]
sec.page_height=Cm(29.7);sec.page_width=Cm(21)
sec.top_margin=Cm(1.8);sec.bottom_margin=Cm(1.7);sec.left_margin=sec.right_margin=Cm(1.8)
for name in ['Normal','Title','Heading 1','Heading 2']:
 st=doc.styles[name];st.font.name='Microsoft YaHei';st._element.rPr.rFonts.set(qn('w:eastAsia'),'Microsoft YaHei');st.font.color.rgb=RGBColor(0,0,0)
 st.font.size=Pt(10 if name=='Normal' else 21 if name=='Title' else 13)
 st.paragraph_format.space_after=Pt(6)
 st.paragraph_format.line_spacing=1.15

def para(t):doc.add_paragraph(t)
def head(t):doc.add_heading(t,level=1)
def table(headers,rows,widths):
 t=doc.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 for c,w in zip(t.columns,widths):c.width=Cm(w)
 for i,v in enumerate(headers):t.rows[0].cells[i].text=v
 for row in rows:
  cells=t.add_row().cells
  for c,v in zip(cells,row):c.text=v
 for ri,row in enumerate(t.rows):
  trpr=row._tr.get_or_add_trPr();cant=OxmlElement('w:cantSplit');trpr.append(cant)
  if ri==0:trpr.append(OxmlElement('w:tblHeader'))
  for ci,c in enumerate(row.cells):
   c.width=Cm(widths[ci]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   pr=c._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');b.append(e)
   pr.append(b)
   mar=OxmlElement('w:tcMar')
   for edge in ['top','left','bottom','right']:
    e=OxmlElement('w:'+edge);e.set(qn('w:w'),'90');e.set(qn('w:type'),'dxa');mar.append(e)
   pr.append(mar)
   if ri==0:
    sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E8EEF3');pr.append(sh)
   for p in c.paragraphs:
    p.paragraph_format.space_after=Pt(2);p.paragraph_format.line_spacing=1.1
    for r in p.runs:r.font.size=Pt(9);r.bold=ri==0
 doc.add_paragraph().paragraph_format.space_after=Pt(0)

doc.add_paragraph('OSCAR 四页面接口对接进度与支持事项',style='Title')
para('进度同步材料    2026年11月6日')
para('本次范围为首页、站点搜索、数据导出和站点详情四个页面。核心查询及下载逻辑已接入真实数据源，地图点位截断问题已修复。当前重点是可访问外网环境中的联调验收，以及部署代理和性能要求确认。')
head('一 已完成工作')
for t in ['首页和搜索地图独立于列表分页，按视野及筛选条件每次读取500条，持续分页；取消每种类型60条、列表当前页25条的地图限制。','低缩放使用前端聚合，以圆圈大小表示密度，不显示聚合数字和地图数量；放大后逐步拆分，6级起显示单站。','地图移动时取消旧请求，移除演示点兜底；保留加载中、失败及重试提示。','导出页按条件分页读取真实记录并生成CSV和JSON；详情页支持JSON、原始WMDR XML和OSCAR报告PDF下载。','类型检查、生产构建及接口客户端回归测试通过。真实远端浏览器验收尚未完成。']:
 doc.add_paragraph(t,style='List Bullet')
head('二 页面与数据来源')
table(['页面','真实数据来源及实现'],[
('首页  #/','WMO目录提供搜索、站点元数据和基础计数；地图前端聚合。'),
('搜索  #/search','WMO目录提供筛选、列表分页和匹配总数；地图独立按视野加载。'),
('导出  #/export','WMO目录提供真实记录；CSV和JSON文件由前端生成。'),
('站点详情','WMO目录提供详情和JSON；XML及PDF使用OSCAR外部服务。')],[4,13.4])
para('重点验收站点：0-21016-30320-2225。需确认目录记录、原始XML来源及OSCAR报告均可用；不能仅凭代码接入认定该站点全部下载已验证。')
head('三 下载格式的接口边界')
table(['格式','当前方式与限制'],[
('JSON','目录直接返回单站GeoJSON，可保存原始记录。'),
('CSV','目录声明支持CSV，但此前核实出现HTTP 500；当前使用真实JSON在前端转换。'),
('XML','读取记录的original链接，访问OSCAR OAI源并提取原始WMDR XML。'),
('PDF','使用OSCAR站点查询和报告下载接口；项目另附定位地图页。目录此前核实未发现直接PDF接口。')],[2,15.4])
doc.add_page_break()
head('四 当前问题及解决方案')
table(['当前问题','解决方案和后续工作'],[
('全球地图加载性能','前端聚合仍需逐页读取站点。先在目标环境测量耗时；如不满足要求，增加服务端聚合或矢量瓦片。'),
('真实环境验收未完成','当前环境访问WMO目录失败。需在可访问WMO和OSCAR的环境联调四页及指定站点。'),
('XML及PDF依赖外部服务','保留固定代理并验证上游响应。缺失来源或下载失败时明确报错，不替换演示文件。'),
('大批量导出依赖浏览器','当前导出需保持页面打开。若要求全库后台导出、任务恢复或历史记录，增加异步导出服务。'),
('分页与视野边界','跨日期变更线暂扩大到全经度查询以避免遗漏，可能增加请求量；上游更新期间offset分页仍可能发生数据偏移。')],[4.1,13.3])
head('五 需要提供的支持')
table(['支持事项','需落实的内容','建议对接方'],[
('网络与部署','浏览器可访问WMO目录，代理服务器可访问OSCAR；配置现有三个下载代理。','部署及运维'),
('测试与验收','提供可用测试环境、代表性站点和验收人；验证地图、筛选、导出及指定站点下载。','业务及测试'),
('性能要求','确认全球地图可接受加载时间、最大导出规模及耗时要求。','业务及技术负责人'),
('按需后端能力','仅在性能要求超出现有方案时，提供地图聚合或瓦片，以及异步导出任务接口。','后端团队')],[3,10,4.4])
para('按当前四页范围，无需新增登录、用户管理、站点编辑审核、仪器、站群及文献等业务接口。现有下载方式可接受时，也无需重新开发四种格式的下载接口。')
head('六 部署及联调检查')
for t in ['配置 /wmdr-source、/oscar-station、/oscar-pdf，并验证转发至OSCAR的接口可用。','验证首页和搜索地图可持续加载、筛选一致，移动地图后不显示旧请求结果。','验证筛选导出、单站JSON、XML和PDF下载；确认无记录和失败场景提示清晰。']:
 doc.add_paragraph(t,style='List Bullet')
para('数据源：wmo-resource-catalogue.labs.wis2dev.io；oscar.wmo.int。当前接入及历史核实记录不能视为官方服务长期稳定性承诺。')
doc.save(out)
print(out.resolve())
