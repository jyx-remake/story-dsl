# 开局答题
toast(false)
call 试炼之地奖励
background('地图.竹林')
change_item('小还丹', 3)
change_silver(100)
：[#style=bold]在来到这个世界之前，请允许询问您几个问题
- 继续……
：[#style=bold]你希望你在武侠小说中的出身是
- 商人的儿子
  change_stat('主角', '臂力', -5)
  change_item('黑玉断续膏')
  change_item('九转熊蛇丸')
  change_item('金丝道袍')
  change_item('金头箍')
  set_model('主角', 'zydx')
- 大草原上长大的孩子
  change_stat('主角', '身法', 15)
  change_stat('主角', '定力', -2)
  change_stat('主角', '拳掌', 15)
  learn_talent('主角', '猎人')
  set_model('主角', 'caoyuan')
- 名门世家
  change_stat('主角', '福缘', 3)
  change_stat('主角', '臂力', -3)
  change_stat('主角', '定力', 2)
  change_stat('主角', '悟性', 20)
  change_stat('主角', '剑法', 2)
  change_stat('主角', '根骨', 2)
  change_item('银手镯')
  change_silver(100)
  set_model('主角', 'huodu')
- 市井流浪的汉子
  change_stat('主角', '福缘', -5)
  change_stat('主角', '臂力', 12)
  change_stat('主角', '刀法', 15)
  change_stat('主角', '奇门', 12)
  change_item('草帽')
  set_model('主角', 'shijing')
  change_silver(-100)
- 疯子
  change_stat('主角', '悟性', 35)
  change_stat('主角', '定力', 10)
  change_stat('主角', '根骨', 10)
  learn_talent('主角', '神经病')
  set_model('主角', 'fengzi')
- 书香门第
  change_stat('主角', '悟性', 20)
  change_stat('主角', '臂力', 1)
  change_stat('主角', '身法', -10)
  change_stat('主角', '根骨', -5)
  set_model('主角', 'xiake')
：[#style=bold]以下你觉得最宝贵的是
- 无尽的财宝
  change_silver(1000)
- 永恒的爱情
  change_stat('主角', '福缘', 15)
- 坚强的意志
  change_stat('主角', '定力', 15)
- 自由
  change_stat('主角', '身法', 15)
- 至高无上的权力
  learn_talent('主角', '自我主义')
：[#style=bold]以下你觉得最可恶的行为是
- 调戏妇女
  change_stat('主角', '定力', 9)
- 欺软怕硬
  change_stat('主角', '根骨', 6)
  change_stat('主角', '定力', 6)
- 偷奸耍滑
  change_stat('主角', '悟性', 10)
- 切JJ练神功
  change_stat('主角', '根骨', 10)
- 有美女不泡
  learn_talent('主角', '好色')
：[#style=bold]你最喜欢的兵刃是
- 拳
  change_stat('主角', '拳掌', 10)
- 剑
  change_stat('主角', '剑法', 10)
- 刀
  change_stat('主角', '刀法', 10)
- 暗器
  change_stat('主角', '奇门', 10)
：[#style=bold]以下女性角色你最喜欢的是
- 黄蓉
  change_stat('主角', '悟性', 5)
- 小龙女
  change_stat('主角', '定力', 5)
- 郭襄
  change_stat('主角', '福缘', 5)
  change_stat('主角', '根骨', 5)
- 梅超风
  change_stat('主角', '拳掌', 6)
  change_stat('主角', '臂力', 6)
- 周芷若
  change_stat('主角', '定力', 10)
：[#style=bold]以下男性角色你最喜欢的是
- 张无忌
  change_stat('主角', '悟性', 5)
  change_stat('主角', '根骨', 10)
- 郭靖
  change_stat('主角', '悟性', -10)
  change_stat('主角', '福缘', 15)
  change_stat('主角', '臂力', 5)
- 杨过
  change_stat('主角', '悟性', 5)
  change_stat('主角', '定力', 5)
- 令狐冲
  change_stat('主角', '悟性', 10)
- 林平之
  change_stat('主角', '剑法', 10)
  change_stat('主角', '定力', 10)

：[#style=bold]以下你觉得最牛的人是
- 乔峰
  change_stat('主角', '臂力', 10)
  change_stat('主角', '拳掌', 9)
- 韦小宝 
  change_stat('主角', '福缘', 20)
- 金庸先生
  change_stat('主角', '悟性', 13)
  change_stat('主角', '剑法', 5)
  change_stat('主角', '刀法', 5)
  change_stat('主角', '拳掌', 5)
  change_stat('主角', '奇门', 5)
- 东方不败
  change_stat('主角', '根骨', 20)
- 汉家松鼠
  change_stat('主角', '根骨', 10)
  learn_internal('主角', '基本内功', 20)
  change_item('松果', 3)
- 半瓶神仙醋
  change_item('天王保命丹', 6)
：[#style=bold]选择你的游戏难度
if round == 1
  - 简单
    set_difficulty('normal')
- [color=yellow]进阶[/color]
  set_difficulty('hard')
- [color=red]炼狱[/color]
  set_difficulty('crazy')
- [color=red]炼狱[/color] + [color=magenta]无悔[/color]
  set_difficulty('crazy')
  set_no_regret(true)
call 周目奖励
：[#style=bold]请输入你的名字
- 继续……
  input_name('主角', '小虾米')
：[#style=bold]请选择人物头像
- 继续……
  select_portrait('主角')
：[#style=bold]欢迎来到金庸群侠传的世界
- 继续……
  roll_stats()

toast(true)
jump 新手村_出生

# 试炼之地奖励
if round == 1
  return

if last_trial_count >= 20
  change_item('真葵花宝典')
elif last_trial_count >= 15
  change_item('武穆遗书')
  change_item('笑傲江湖曲')
elif last_trial_count >= 12
  change_item('沾衣十八跌')
  change_item('易筋经')
  change_item('厚黑学')
elif last_trial_count >= 9
  change_item('素心神剑心得')
  change_item('太极心得手抄本')
  change_item('乾坤大挪移心法')
elif last_trial_count >= 6
  change_item('灵心慧质')
  change_item('妙手仁心')
elif last_trial_count >= 3
  change_item('王母蟠桃')
  change_item('道家仙丹')

# 周目奖励
if round == 1
  if difficulty == 'normal'
    add_random_item(['新手礼包-大蟠桃'], 5)
elif round == 2
  add_random_item(['佛光普照', '百变千幻云雾十三式秘籍', '反两仪刀法', '伏魔杖法'], 1)
  add_random_item(['灭仙爪', '倚天剑', '屠龙刀', '打狗棒'], 1)
elif round == 3
  add_random_item(['隔空取物', '妙手仁心', '飞向天际', '血刀'], 1)
  add_random_item(['仙丽雅的项链', '李延宗的项链', '王语嫣的武学概要', '神木王鼎'], 1)
else
  add_random_item(['碎裂的怒吼', '沾衣十八跌', '灵心慧质', '不老长春功法'], 1)
  add_random_item(['仙丽雅的项链', '李延宗的项链', '王语嫣的武学概要', '神木王鼎'], 1)
if round == 2
  join_random(['鲁连荣', '冲虚道长', '方证大师', '灭绝师太', '张翠山', '宋远桥', '韦一笑', '仪清', '何太冲', '哑仆', '温方达', '温方义', '温方山', '温方施', '温方悟', '安小慧', '阿九'])
elif round == 3
  join_random(['紫衫龙王', '殷天正', '商剑鸣', '杨逍', '范遥', '霍都', '孙不二', '龙岛主', '木岛主', '善勇'])
elif round == 4
  join_random(['白自在', '向问天', '丁春秋', '成昆', '段延庆', '丘处机', '欧阳锋'])
elif not (round == 1)
  join_random(['任我行', '王重阳', '林朝英', '归辛树', '玉真子', '慕容博', '卓一航', '谢逊', '虚竹'])
