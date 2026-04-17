'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  GraduationCap,
  BookOpen,
  Clock,
  Users,
  Star,
  ChevronRight,
  Play,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface Lesson {
  id: string
  title: string
  description: string | null
  type: string
  duration: string | null
  order: number
  isFree: boolean
}

interface Module {
  id: string
  title: string
  description: string | null
  order: number
  duration: string | null
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  domain: string
  level: string
  duration: string | null
  icon: string | null
  rating: string
  enrolled: number
  modules: Module[]
}

const domainColors: Record<string, string> = {
  electrical: 'from-amber-500 to-orange-600',
  mechanical: 'from-slate-500 to-zinc-600',
  civil: 'from-orange-500 to-red-600',
  hvac: 'from-cyan-500 to-blue-600',
}

const domainIcons: Record<string, string> = {
  electrical: '⚡',
  mechanical: '⚙️',
  civil: '🏗️',
  hvac: '❄️',
}

const levelColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function LearningSection() {
  const [courses, setCourses] = React.useState<Course[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedCourse, setSelectedCourse] = React.useState<Course | null>(null)
  const [expandedModules, setExpandedModules] = React.useState<string[]>([])

  React.useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch('/api/courses')
        if (res.ok) {
          setCourses(await res.json())
        }
      } catch (err) {
        console.error('Failed to load courses:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCourses()
  }, [])

  const totalLessons = (course: Course) =>
    course.modules.reduce((sum, m) => sum + m.lessons.length, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-emerald-600" />
          Learning Platform
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Engineering courses with interactive lessons and quizzes
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_350px] gap-4">
        {/* Course Content */}
        <div className="space-y-4">
          {selectedCourse ? (
            <>
              <Card className="overflow-hidden">
                <div className={`h-24 bg-gradient-to-r ${domainColors[selectedCourse.domain] || 'from-emerald-500 to-teal-600'}`} />
                <CardHeader className="-mt-8 relative">
                  <div className="flex items-end gap-4">
                    <div className="h-16 w-16 rounded-xl bg-background border-4 border-background flex items-center justify-center text-3xl shadow-md">
                      {domainIcons[selectedCourse.domain] || '📚'}
                    </div>
                    <div className="flex-1 pb-1">
                      <CardTitle className="text-lg">{selectedCourse.title}</CardTitle>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge className={levelColors[selectedCourse.level] || ''}>
                          {selectedCourse.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {selectedCourse.duration || 'Self-paced'}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {totalLessons(selectedCourse)} lessons
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {selectedCourse.description || `Learn ${selectedCourse.domain} engineering fundamentals through structured modules and interactive lessons.`}
                  </p>
                </CardContent>
              </Card>

              {/* Modules & Lessons */}
              <Accordion
                type="multiple"
                value={expandedModules}
                onValueChange={setExpandedModules}
                className="space-y-2"
              >
                {selectedCourse.modules.map(mod => (
                  <Card key={mod.id}>
                    <AccordionItem value={mod.id} className="border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 rounded-lg">
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            {mod.order}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{mod.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {mod.lessons.length} lessons {mod.duration ? `· ${mod.duration}` : ''}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-3">
                        <div className="space-y-1 ml-11">
                          {mod.lessons.map(lesson => (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 cursor-pointer group"
                            >
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                                lesson.isFree
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {lesson.isFree ? (
                                  <Play className="h-3 w-3" />
                                ) : (
                                  <Lock className="h-3 w-3" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{lesson.title}</p>
                                {lesson.duration && (
                                  <p className="text-[10px] text-muted-foreground">{lesson.duration}</p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {lesson.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                ))}
              </Accordion>

              <Button
                variant="outline"
                onClick={() => setSelectedCourse(null)}
                className="w-full"
              >
                ← Back to Course List
              </Button>
            </>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <Card key={i} className="overflow-hidden">
                    <div className="h-24 bg-muted animate-pulse" />
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                courses.map(course => (
                  <Card
                    key={course.id}
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => {
                      setSelectedCourse(course)
                      setExpandedModules([course.modules[0]?.id || ''])
                    }}
                  >
                    <div className={`h-20 bg-gradient-to-r ${domainColors[course.domain] || 'from-emerald-500 to-teal-600'} flex items-center justify-center`}>
                      <span className="text-4xl">{domainIcons[course.domain] || '📚'}</span>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {course.description || `Master ${course.domain} engineering fundamentals`}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={`text-[10px] ${levelColors[course.level] || ''}`}>
                          {course.level}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {totalLessons(course)} lessons
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {course.enrolled}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Enrolled Courses</span>
                <span className="font-bold">{courses.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Lessons Completed</span>
                <span className="font-bold text-emerald-600">0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Total Lessons</span>
                <span className="font-bold">{courses.reduce((s, c) => s + totalLessons(c), 0)}</span>
              </div>
              <Progress value={0} className="h-2" />
              <p className="text-xs text-muted-foreground">Start learning to track your progress!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Available Domains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['Electrical', 'Mechanical', 'Civil', 'HVAC'].map(domain => {
                  const count = courses.filter(c => c.domain === domain.toLowerCase()).length
                  return (
                    <div key={domain} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{domainIcons[domain.toLowerCase()]}</span>
                        {domain}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{count} courses</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
