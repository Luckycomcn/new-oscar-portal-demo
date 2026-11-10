from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from pathlib import Path
D=Document(); sec=D.sections[0]
sec.page_width=Inches(8.5); sec.page_height=Inches(11)
sec.top_margin=Inches(.7); sec.bottom_margin=Inches(.65); sec.left_margin=sec.right_margin=Inches(.7)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2']:
 s=D.styles[name]; s.font.name='Microsoft YaHei'; s.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'Microsoft YaHei'); s.font.color.rgb=RGBColor(0,0,0)
 s.font.size=Pt(11)
 s.paragraph_format.space_after=Pt(7); s.paragraph_format.line_spacing=1.15
D.styles['Title'].font.size=Pt(23); D.styles['Title'].font.bold=True
D.styles['Heading 1'].font.size=Pt(15); D.styles['Heading 1'].font.bold=True
D.styles['Heading 1'].paragraph_format.space_before=Pt(12)
D.styles['Heading 2'].font.size=Pt(12); D.styles['Heading 2'].font.bold=True
D.core_properties.title='OSCAR Next 真实接口对接进展汇报'; D.core_properties.author=''
def p(text): return D.add_paragraph(text)
def table(headers, rows, widths):
 t=D.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
 for c,w in zip(t.columns,widths): c.width=Inches(w)
 for c,v in zip(t.rows[0].cells,headers): c.text=v
 repeat=OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(repeat)
 for row in rows:
  for c,v in zip(t.add_row().cells,row): c.text=v
 for i,row in enumerate(t.rows):
  pr=row._tr.get_or_add_trPr(); pr.append(OxmlElement('w:cantSplit'))
  for c,w in zip(row.cells,widths):
   c.width=Inches(w); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   tcpr=c._tc.get_or_add_tcPr(); borders=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    el=OxmlElement('w:'+edge); el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'4'); el.set(qn('w:color'),'D9D9D9'); borders.append(el)
   tcpr.append(borders)
   shade=OxmlElement('w:shd'); shade.set(qn('w:fill'),'DBE8EF' if i==0 else ('F4F7F9' if i%2==0 else 'FFFFFF')); tcpr.append(shade)
   margins=OxmlElement('w:tcMar')
   for edge in ['top','left','bottom','right']:
    el=OxmlElement('w:'+edge); el.set(qn('w:w'),'90'); el.set(qn('w:type'),'dxa'); margins.append(el)
   tcpr.append(margins)
   for para in c.paragraphs:
    para.paragraph_format.space_after=Pt(2); para.paragraph_format.space_before=Pt(2); para.paragraph_format.line_spacing=1.1
    for run in para.runs: run.font.size=Pt(10.5); run.bold=i==0
 return t
D.add_paragraph('OSCAR Next 真实接口对接进展汇报','Title')
p('汇报日期  2026年10月27日')
p('本次已将站点查询、详情、下载、批量导出及元数据校验转换接入 WMO 公开资源目录，主要数据浏览流程已可使用真实记录。用户权限、站点保存审核等业务功能仍缺少接口支持，尚不能形成完整的生产业务闭环。')
D.add_heading('一 已接入的真实接口',1)
table(['功能','本次完成情况'],[
('站点查询','真实站点搜索、条件筛选及分页；完整 WIGOS ID 按单站接口查询。'),
('站点详情','基本信息、坐标、观测项目、联系人及国家地区归属有效期。'),
('首页数据','站点总数与地图点位接入；类型数量按真实记录统计，排除 unknown。'),
('首页快速搜索','移除本地示例兜底；失败时显示错误与重试，避免旧请求覆盖新结果。'),
('联系人查询','从真实站点内嵌 contacts 获取名称、机构及联系方式。'),
('单站下载','JSON 为完整原始记录；XML 来自官方原始文件；CSV 从真实记录转换。'),
('批量导出','按每页250条读取全部或筛选结果；支持进度、取消、错误提示，预览与下载同源。'),
('WMDR2 校验','调用官方校验服务，展示通过、失败及具体问题，不将请求成功视为校验通过。'),
('WMDR1 转换','调用官方 XML 转 WMDR2 服务，结果可下载并继续校验。')],[1.35,5.75])
p('说明：元数据校验和转换仅处理输入并返回结果，不会保存或发布站点。')
D.add_page_break()
D.add_heading('二 尚未替换与当前限制',1)
table(['项目','当前状态及影响'],[
('下拉选项','国家、类型、计划、变量等仍为本地词表。目录提供筛选字段说明，但没有完整候选值列表接口。'),
('覆盖国家数量','仍统计本地地域词表，尚不代表真实目录的实际覆盖数量。'),
('最后更新时间','当前使用最新记录创建日期；需调整名称或取得可靠的更新统计口径。'),
('地图加载','真实接口按地图范围限量加载，每类最多60个站点；密集区域可能漏点，尚未接入矢量瓦片。'),
('旧数据兜底','部分旧查询入口和地图异常兜底仍保留本地快照或示例数据，需要继续清理。'),
('业务管理','登录、用户权限、站点编辑保存、审核及反馈仍为演示功能。'),
('其他查询','仪器、站群、文献等功能仍使用本地演示数据。'),
('PDF 与 CSV','未发现 PDF 下载接口，入口已停用；目录 CSV 接口实测报错，当前由前端转换真实数据。')],[1.35,5.75])
D.add_heading('三 当前接口与数据风险',1)
p('公开记录本身可能存在质量问题。以站点 0-22000-0-2501589 为例，官方校验返回两项测试失败，指出时间格式、邮箱及代码表值等问题；前端保留并展示原始结果。')
p('当前依赖公开实验目录的可用性。上线前仍需明确正式服务地址、调用限制、更新频率、故障处理及数据责任人。涉及大批量导出时，应评估后端任务和缓存方案。')
D.add_page_break()
D.add_heading('四 需协调提供的接口',1)
for title,body in [
('身份认证与权限','提供登录、退出、用户信息、角色及数据范围权限接口，明确认证方式和服务端校验规则。'),
('站点维护与审核','提供新增、修改、保存、审核和历史记录接口；明确数据模型、校验要求及发布流程。现有校验转换服务不能替代保存接口。'),
('统计与参考数据','提供实际覆盖国家数、分类汇总及最后更新时间；明确统计口径。下拉词表需提供完整接口或版本化文件及更新机制。'),
('其他业务与报告','按需求提供仪器、站群、文献、反馈提交和 PDF 报告生成接口。'),
('对接与运行保障','提供接口文档、测试环境、必要凭据、跨域与限流规则、错误码、维护联系人；明确正式部署方案。')]:
 D.add_heading(title,2); p(body)
D.add_heading('五 验证情况与建议安排',1)
p('已通过类型检查、生产构建和客户端回归测试。已在浏览器验证关键查询、筛选导出预览、单站 JSON 生成及官方校验结果；XML 代理和两项处理服务已进行真实请求验证。全库导出尚未完整执行，尚不能据此认定已完成生产验收。')
p('建议先确认统计口径和业务接口负责人，继续清理示例数据并验证地图瓦片服务；随后对接权限、站点保存审核，最后开展全库导出、性能及部署验收。')
D.add_heading('接口依据',2)
p('公开目录 https://wmo-resource-catalogue.labs.wis2dev.io')
p('接口定义 /openapi?f=json\n站点集合 /collections/wigos-observing-facility-metadata\n处理服务 /processes/pywmdr-wigos-wmdr2-ets/execution\n处理服务 /processes/pywmdr-wmdr2-migrate/execution')
D.save('docs/OSCAR接口对接进展汇报.docx')
print('Saved docs/OSCAR接口对接进展汇报.docx')
