# 开局答题
toast off
call 试炼之地奖励
background 地图.竹林
item 小还丹 3
get_money 100
：[#style=bold]在来到这个世界之前，请允许询问您几个问题
- 继续……
：[#style=bold]你希望你在武侠小说中的出身是
- 商人的儿子
  upgrade 臂力 主角 -5
  item 黑玉断续膏
  item 九转熊蛇丸
  item 金丝道袍
  item 金头箍 
  animation 主角 zydx
- 大草原上长大的孩子
  upgrade 身法 主角 15
  upgrade 定力 主角 -2
  upgrade 拳掌 主角 15
  learn talent 主角 猎人
  animation 主角 caoyuan 
- 名门世家
  upgrade 福缘 主角 3
  upgrade 臂力 主角 -3
  upgrade 定力 主角 2
  upgrade 悟性 主角 20
  upgrade 剑法 主角 2
  upgrade 根骨 主角 2
  item 银手镯
  get_money 100
  animation 主角 huodu
- 市井流浪的汉子
  upgrade 福缘 主角 -5
  upgrade 臂力 主角 12
  upgrade 刀法 主角 15
  upgrade 奇门 主角 12
  item 草帽
  animation 主角 shijing 
  get_money -100
- 疯子
  upgrade 悟性 主角 35
  upgrade 定力 主角 10
  upgrade 根骨 主角 10
  learn talent 主角 神经病
  animation 主角 fengzi 
- 书香门第
  upgrade 悟性 主角 20
  upgrade 臂力 主角 1
  upgrade 身法 主角 -10
  upgrade 根骨 主角 -5
  animation 主角 xiake 
：[#style=bold]以下你觉得最宝贵的是
- 无尽的财宝
  get_money 1000
- 永恒的爱情
  upgrade 福缘 主角 15
- 坚强的意志
  upgrade 定力 主角 15
- 自由
  upgrade 身法 主角 15
- 至高无上的权力
  learn talent 主角 自我主义
：[#style=bold]以下你觉得最可恶的行为是
- 调戏妇女
  upgrade 定力 主角 9
- 欺软怕硬
  upgrade 根骨 主角 6
  upgrade 定力 主角 6
- 偷奸耍滑
  upgrade 悟性 主角 10
- 切JJ练神功
  upgrade 根骨 主角 10
- 有美女不泡
  learn talent 主角 好色
：[#style=bold]你最喜欢的兵刃是
- 拳
  upgrade 拳掌 主角 10
- 剑
  upgrade 剑法 主角 10
- 刀
  upgrade 刀法 主角 10
- 暗器
  upgrade 奇门 主角 10
：[#style=bold]以下女性角色你最喜欢的是
- 黄蓉
  upgrade 悟性 主角 5
- 小龙女
  upgrade 定力 主角 5
- 郭襄
  upgrade 福缘 主角 5
  upgrade 根骨 主角 5
- 梅超风
  upgrade 拳掌 主角 6
  upgrade 臂力 主角 6
- 周芷若
  upgrade 定力 主角 10
：[#style=bold]以下男性角色你最喜欢的是
- 张无忌
  upgrade 悟性 主角 5
  upgrade 根骨 主角 10
- 郭靖
  upgrade 悟性 主角 -10
  upgrade 福缘 主角 15
  upgrade 臂力 主角 5
- 杨过
  upgrade 悟性 主角 5
  upgrade 定力 主角 5
- 令狐冲
  upgrade 悟性 主角 10
- 林平之
  upgrade 剑法 主角 10
  upgrade 定力 主角 10

：[#style=bold]以下你觉得最牛的人是
- 乔峰
  upgrade 臂力 主角 10
  upgrade 拳掌 主角 9
- 韦小宝 
  upgrade 福缘 主角 20
- 金庸先生
  upgrade 悟性 主角 13
  upgrade 剑法 主角 5
  upgrade 刀法 主角 5
  upgrade 拳掌 主角 5
  upgrade 奇门 主角 5
- 东方不败
  upgrade 根骨 主角 20
- 汉家松鼠
  upgrade 根骨 主角 10
  learn internal 主角 基本内功 20
  item 松果 3
- 半瓶神仙醋
  item 天王保命丹 6
：[#style=bold]选择你的游戏难度
when in_round 1
  - 简单
    set_game_mode normal
- [color=yellow]进阶[/color]
  set_game_mode hard
- [color=red]炼狱[/color]
  set_game_mode crazy
- [color=red]炼狱[/color] + [color=magenta]无悔[/color]
  set_game_mode crazy
  set_no_regret
call 周目奖励
：[#style=bold]请输入你的名字
- 继续……
  input_name 主角 小虾米
：[#style=bold]请选择人物头像
- 继续……
  select_head 主角
：[#style=bold]欢迎来到金庸群侠传的世界
- 继续……
  roll_stats

toast on
jump 新手村_出生

# 试炼之地奖励
if in_round 1
  return

if $last_trial_count >= 20
  item 真葵花宝典
elif $last_trial_count >= 15
  item 武穆遗书
  item 笑傲江湖曲
elif $last_trial_count >= 12
  item 沾衣十八跌
  item 易筋经
  item 厚黑学
elif $last_trial_count >= 9
  item 素心神剑心得
  item 太极心得手抄本
  item 乾坤大挪移心法
elif $last_trial_count >= 6
  item 灵心慧质
  item 妙手仁心
elif $last_trial_count >= 3
  item 王母蟠桃
  item 道家仙丹

# 周目奖励
if in_round 1
  if game_mode normal
    random_item [新手礼包-大蟠桃] 5
elif in_round 2
  random_item [佛光普照, 百变千幻云雾十三式秘籍, 反两仪刀法, 伏魔杖法] 1
  random_item [灭仙爪, 倚天剑, 屠龙刀, 打狗棒] 1
elif in_round 3
  random_item [隔空取物, 妙手仁心, 飞向天际, 血刀] 1
  random_item [仙丽雅的项链, 李延宗的项链, 王语嫣的武学概要, 神木王鼎] 1
else
  random_item [碎裂的怒吼, 沾衣十八跌, 灵心慧质, 不老长春功法] 1
  random_item [仙丽雅的项链, 李延宗的项链, 王语嫣的武学概要, 神木王鼎] 1
if in_round 2
  random_join [鲁连荣, 冲虚道长, 方证大师, 灭绝师太, 张翠山, 宋远桥, 韦一笑, 仪清, 何太冲, 哑仆, 温方达, 温方义, 温方山, 温方施, 温方悟, 安小慧, 阿九]
elif in_round 3
  random_join [紫衫龙王, 殷天正, 商剑鸣, 杨逍, 范遥, 霍都, 孙不二, 龙岛主, 木岛主, 善勇]
elif in_round 4
  random_join [白自在, 向问天, 丁春秋, 成昆, 段延庆, 丘处机, 欧阳锋]
elif not in_round 1
  random_join [任我行, 王重阳, 林朝英, 归辛树, 玉真子, 慕容博, 卓一航, 谢逊, 虚竹]