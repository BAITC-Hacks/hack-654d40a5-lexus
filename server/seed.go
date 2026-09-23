package main

import "fmt"

func seed() State {
	s := State{Users: []User{{ID: "b1", Name: "Alem Coffee", Role: "business", Plan: "free"}, {ID: "b2", Name: "Green Step", Role: "business", Plan: "pro"}}, Challenges: []Challenge{}, Teams: []Team{}, Proposals: []Proposal{}, Notifications: []Notification{}, Media: []Media{}}
	names := []string{"Pixel Pioneers", "Qadam Lab", "Nomad Code", "Data Nomads", "Alem Makers"}
	descs := []string{"Превращаем сложные процессы в простые цифровые продукты. Исследуем, проектируем и пишем код.", "Создаём доступные сервисы для города и образования. Любим задачи с реальным социальным эффектом.", "Веб-приложения и автоматизация для малого бизнеса. От первого интервью до рабочего прототипа.", "Находим полезные закономерности в данных. Прогнозирование, аналитика и понятные дашборды.", "Соединяем дизайн, AI и инженерный подход. Быстро проверяем идеи вместе с пользователями."}
	skills := [][]string{{"React", "Go", "UI/UX"}, {"TypeScript", "Accessibility", "Figma"}, {"Python", "React", "PostgreSQL"}, {"Python", "Data Science", "SQL"}, {"AI", "Go", "Design"}}
	for i, n := range names {
		tid := fmt.Sprintf("t%d", i+1)
		s.Teams = append(s.Teams, Team{ID: tid, Name: n, Description: descs[i], University: []string{"KBTU · Алматы", "SDU · Каскелен", "Astana IT University", "КазНУ · Алматы", "Satbayev University"}[i], Skills: skills[i], Members: 3 + i%3, Color: []string{"mint", "peach", "lavender", "blue", "yellow"}[i], Emoji: []string{"🦊", "🌱", "🚀", "🦉", "⚡"}[i], XP: 0, Reviews: []Review{}})
		s.Users = append(s.Users, User{ID: "u" + tid, Name: n, Role: "student", TeamID: tid, Plan: "free"})
	}
	titles := []string{"Меньше списаний. Больше хорошего кофе.", "Карта доступного города", "Умный помощник для приёмной комиссии", "Прогноз спроса для локальной пекарни", "Вторая жизнь университетских вещей"}
	needs := []string{"Хотим понять, сколько выпечки готовить каждый день, чтобы сократить списания в кофейне.", "Нужна карта мест с доступным входом для людей на колясках в Алматы.", "Помочь абитуриентам быстро находить ответы о поступлении на трёх языках.", "Прогнозировать спрос по дням недели для небольшой пекарни.", "Помочь студентам обмениваться учебниками и вещами внутри университета."}
	cats := []string{"Retail", "Social", "Education", "Analytics", "Ecology"}
	for i := 0; i < 5; i++ {
		f := Fields{"title": titles[i], "need": needs[i], "context": "Сейчас сотрудники собирают информацию вручную в таблицах. Это занимает время и приводит к ошибкам.", "users": "Сотрудники и посетители организации. Первую версию проверит небольшая пилотная группа.", "data": "Обезличенная таблица за последние 3 месяца и примеры текущего процесса. Предоставим команде после знакомства.", "constraints": "Прототип за 3 недели. Только обезличенные данные; решение должно запускаться локально.", "result": "Рабочий веб-прототип, инструкция запуска и короткая демонстрация на тестовых данных.", "success": "Пять участников проходят основной сценарий без помощи. Время выполнения уменьшается минимум на 20%.", "contact": "Куратор проекта · demo@example.org", "interaction": "Созвон по вторникам, вопросы в общем чате. Ответ в течение двух рабочих дней."}
		a := map[string]string{}
		counts := []int{10, 8, 6, 4, 2}
		order := []string{"title", "need", "context", "data", "result", "users", "success", "constraints", "contact", "interaction"}
		for j := 0; j < counts[i]; j++ {
			a[order[j]] = hash(f[order[j]])
		}
		if i == 4 {
			for _, k := range fieldKeys {
				if k != "title" && k != "need" {
					f[k] = ""
				}
			}
		}
		c := Challenge{ID: fmt.Sprintf("q%d", i+1), OwnerID: []string{"b1", "b2", "b2", "b1", "b2"}[i], Company: []string{"Alem Coffee", "Green Step", "Alem University", "Nan Bakery", "Campus Circle"}[i], Category: cats[i], Locale: "ru", Fields: f, Approved: a, Revision: 1, CreatedAt: now(), Versions: []Version{}, Activity: []Activity{}}
		publish(&s, &c, "Первичная публикация · демонстрационные данные")
		s.Challenges = append(s.Challenges, c)
		df := Fields{"title": "Идея: " + titles[i], "need": needs[i]}
		s.Challenges = append(s.Challenges, Challenge{ID: fmt.Sprintf("d%d", i+1), OwnerID: "b1", Company: "Alem Coffee", Category: cats[i], Locale: "ru", Fields: df, Approved: map[string]string{}, Revision: 1, Versions: []Version{}, CreatedAt: now(), Activity: []Activity{{"created", now(), needs[i]}}})
	}
	for i := 0; i < 5; i++ {
		p := Proposal{ID: fmt.Sprintf("p%d", i+1), ChallengeID: fmt.Sprintf("q%d", i%2+1), Version: 1, TeamID: fmt.Sprintf("t%d", i+1), Idea: "Начнём с интервью и проверки текущего процесса. Создадим простой прототип и проверим его с пользователями.", Plan: "1. Интервью и анализ данных. 2. Прототип основного сценария. 3. Тестирование и передача документации.", Deadline: "21 день", Link: "https://example.org/prototype", Status: "pending", At: now()}
		s.Proposals = append(s.Proposals, p)
	}
	return s
}
