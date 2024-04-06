package main

import (
	"encoding/json"
	"log"
	"math"
	"os"
	"sync"

	"github.com/jftuga/geodist"
)

type RoadData struct {
	Type        string      `json:"type"`
	Surface     string      `json:"surface"`
	Coordinates [][]float64 `json:"coordinates"`
}

type CityData struct {
	Name        string
	Place       string
	Coordinates []float64
}

type RoadsData struct {
	Features []RoadsFeatures `json:"features"`
}

type RoadsFeatures struct {
	Type       string         `json:"type"`
	Properties RoadProperties `json:"properties"`
	Geometry   RoadGeometry   `json:"geometry"`
}

type RoadProperties struct {
	Type    string `json:"HIGHWAY"`
	Surface string `json:"SURFACE"`
}

type RoadGeometry struct {
	Coordinates [][]float64 `json:"coordinates"`
}

type CitiesData struct {
	Features []CitiesFeatures `json:"features"`
}

type CitiesFeatures struct {
	Type       string           `json:"type"`
	Properties CitiesProperties `json:"properties"`
	Geometry   CitiesGeometry   `json:"geometry"`
}

type CitiesProperties struct {
	Name    string `json:"NAME"`
	Place   string `json:"PLACE"`
	Surface string `json:"SURFACE"`
}

type CitiesGeometry struct {
	Coordinates []float64 `json:"coordinates"`
}

type Result struct {
	City string `json:"city"`
	// Roads  []RRoads `json:"roads"`
	RoadNearby bool    `json:"road_nearby"`
	Rating     float64 `json:"rating"`
}

type RRoads struct {
	Type     string  `json:"type"`
	Surface  string  `json:"surface"`
	Distance float64 `json:"distance"`
}

func getRatingRoads() {
	content, err := os.ReadFile("../parsing/roads4326.geojson")
	if err != nil {
		log.Panic("can not read file")
	}

	var r RoadsData
	if err := json.Unmarshal(content, &r); err != nil {
		log.Panic("can not Unmarshal")
	}

	content, err = os.ReadFile("../parsing/cities4326.geojson")
	if err != nil {
		log.Panic("can not read file")
	}

	var c CitiesData
	if err := json.Unmarshal(content, &c); err != nil {
		log.Panic("can not Unmarshal")
	}

	var roads []RoadData
	for _, j := range r.Features {
		roads = append(roads, RoadData{
			Type:        j.Properties.Type,
			Coordinates: j.Geometry.Coordinates,
		})
	}

	var cities []CityData
	for _, j := range c.Features {
		if j.Properties.Place != "locality" {
			cities = append(cities, CityData{
				Name:        j.Properties.Name,
				Place:       j.Properties.Place,
				Coordinates: j.Geometry.Coordinates,
			})
		}
	}

	var result []Result

	var wg sync.WaitGroup
	var mu sync.Mutex

	goodTypes := make(map[string]bool)
	goodTypes["trunk"] = true
	goodTypes["trunk_link"] = true
	goodTypes["motorway"] = true
	goodTypes["motorway_link"] = true
	goodTypes["primary"] = true
	goodTypes["primary_link"] = true
	goodTypes["secondary"] = true
	goodTypes["secondary_link"] = true
	goodTypes["tertiary"] = true
	goodTypes["tertiary_link"] = true
	goodTypes["unclassified"] = true
	goodTypes["residential"] = true
	goodTypes["service"] = true
	goodTypes["road"] = true

	addResult := func(city CityData, roads []RoadData) {
		var res []RRoads
		defer wg.Done()

		for _, road := range roads {
			for _, coord := range road.Coordinates {
				roadCoord := geodist.Coord{Lat: coord[0], Lon: coord[1]}
				cityCoord := geodist.Coord{Lat: city.Coordinates[0], Lon: city.Coordinates[1]}
				_, km, err := geodist.VincentyDistance(cityCoord, roadCoord)
				if err != nil {
					log.Panic("wtf?")
				}
				if km <= 6 {
					res = append(res, RRoads{
						Distance: km,
						Type:     road.Type,
						Surface:  road.Surface,
					})
				}
			}
		}

		count := float64(0)
		ccc := float64(0)
		for _, s := range res {
			if goodTypes[s.Type] {
				switch s.Type {
				case "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link":
					ccc++
				default:
					count = count + s.Distance/6
				}
			}
		}
		if count > 100 {
			count = 100
		}
		rn := false
		if ccc > 5 {
			ccc = 5
			rn = true
		} else {
			if ccc > 0 {
				rn = true
			}
			ccc = 4
		}

		rating := (count / 100) * ccc

		mu.Lock()
		result = append(result, Result{
			// Roads:  res,
			Rating:     rating,
			RoadNearby: rn,
			City:       city.Name,
		})

		log.Printf("%s: %v,%v", city.Name, rating, count)
		mu.Unlock()
	}

	for _, city := range cities {
		wg.Add(1)
		go addResult(city, roads)
	}

	log.Println("READY")

	wg.Wait()
	content, err = json.MarshalIndent(result, "", " ")
	if err != nil {
		log.Panic(err.Error())
	}

	if err := os.WriteFile("result_road.json", content, 0644); err != nil {
		log.Panic(err.Error())
	}
}

type BusData struct {
	Name        string    `json:"name"`
	Coordinates []float64 `json:"coordinates"`
}

type BusDataJSON struct {
	Features []BusFeatures `json:"features"`
}

type BusFeatures struct {
	Type       string        `json:"type"`
	Properties BusProperties `json:"properties"`
	Geometry   BusGeometry   `json:"geometry"`
}

type BusProperties struct {
	Name string `json:"NAME"`
}

type BusGeometry struct {
	Coordinates []float64 `json:"coordinates"`
}

type ResultBus struct {
	City        string  `json:"city"`
	BusStations int     `json:"bus_stations"`
	Rating      float64 `json:"rating"`
}

type BusDataWithDistance struct {
	BusData  BusData `json:"bus"`
	Distance float64 `json:"distance"`
}

func getBuses() {
	content, err := os.ReadFile("../parsing/bus4326.geojson")
	if err != nil {
		log.Panic("can not read file")
	}

	var r BusDataJSON
	if err := json.Unmarshal(content, &r); err != nil {
		log.Panic("can not Unmarshal")
	}

	content, err = os.ReadFile("../parsing/cities4326.geojson")
	if err != nil {
		log.Panic("can not read file")
	}

	var c CitiesData
	if err := json.Unmarshal(content, &c); err != nil {
		log.Panic("can not Unmarshal")
	}

	var buses []BusData
	for _, j := range r.Features {
		buses = append(buses, BusData{
			Name:        j.Properties.Name,
			Coordinates: j.Geometry.Coordinates,
		})
	}

	var cities []CityData
	for _, j := range c.Features {
		if j.Properties.Place != "locality" {
			cities = append(cities, CityData{
				Name:        j.Properties.Name,
				Place:       j.Properties.Place,
				Coordinates: j.Geometry.Coordinates,
			})
		}
	}

	var result []ResultBus
	for _, city := range cities {
		var buss []BusDataWithDistance
		c := 0.
		for _, bus := range buses {
			busCoord := geodist.Coord{Lat: bus.Coordinates[0], Lon: bus.Coordinates[1]}
			cityCoord := geodist.Coord{Lat: city.Coordinates[0], Lon: city.Coordinates[1]}
			_, km, err := geodist.VincentyDistance(cityCoord, busCoord)
			if err != nil {
				log.Panic(err.Error())
			}
			if km <= 15 {
				buss = append(buss, BusDataWithDistance{
					BusData:  bus,
					Distance: km,
				})
				c += km / 15
			}
		}
		if c >= 10 {
			c = 10
		}
		result = append(result, ResultBus{
			City:        city.Name,
			BusStations: len(buss),
			Rating:      (c / 10) * 5,
		})
	}

	content, err = json.MarshalIndent(result, "", " ")
	if err != nil {
		log.Panic(err.Error())
	}

	if err := os.WriteFile("result_bus.json", content, 0644); err != nil {
		log.Panic(err.Error())
	}
}

type AirportData struct {
	Name        string          `json:"name,omitempty"`
	Coordinates [][][][]float64 `json:"coordinates"`
}

type AirportDataJSON struct {
	Features []AirportFeatures `json:"features"`
}

type AirportFeatures struct {
	Type       string            `json:"type"`
	Properties AirportProperties `json:"properties"`
	Geometry   AirportGeometry   `json:"geometry"`
}

type AirportProperties struct {
	Name string `json:"NAME"`
}

type AirportGeometry struct {
	Coordinates [][][][]float64 `json:"coordinates"`
}

type AirportResult struct {
	City          string `json:"city"`
	AirportNearby bool   `json:"airport_nearby"`
	Rating        int    `json:"rating"`
}

type AirportDataWithDistance struct {
	BusData  AirportData `json:"airport"`
	Distance float64     `json:"distance"`
}

func getAirports() {
	content, err := os.ReadFile("../parsing/flight4326.geojson")
	if err != nil {
		log.Panic("can not read file")
	}

	var r AirportDataJSON
	if err := json.Unmarshal(content, &r); err != nil {
		log.Panic("can not Unmarshal")
	}

	content, err = os.ReadFile("../parsing/cities4326.geojson")
	if err != nil {
		log.Panic("can not read file")
	}

	var c CitiesData
	if err := json.Unmarshal(content, &c); err != nil {
		log.Panic("can not Unmarshal")
	}

	var buses []AirportData
	for _, j := range r.Features {
		if len(j.Properties.Name) > 0 {
			buses = append(buses, AirportData{
				Name:        j.Properties.Name,
				Coordinates: j.Geometry.Coordinates,
			})
		}
	}

	var cities []CityData
	for _, j := range c.Features {
		if j.Properties.Place != "locality" {
			cities = append(cities, CityData{
				Name:        j.Properties.Name,
				Place:       j.Properties.Place,
				Coordinates: j.Geometry.Coordinates,
			})
		}
	}

	var result []AirportResult
	for _, city := range cities {
		min := AirportDataWithDistance{
			Distance: 10000000.,
		}
		for _, bus := range buses {
			busCoord := geodist.Coord{Lat: bus.Coordinates[0][0][0][0], Lon: bus.Coordinates[0][0][0][1]}
			cityCoord := geodist.Coord{Lat: city.Coordinates[0], Lon: city.Coordinates[1]}
			_, km, err := geodist.VincentyDistance(cityCoord, busCoord)
			if err != nil {
				log.Panic(err.Error())
			}
			if km < min.Distance {
				min = AirportDataWithDistance{
					BusData:  bus,
					Distance: km,
				}
			}
		}
		if min.Distance < 15 {
			result = append(result, AirportResult{
				City:          city.Name,
				AirportNearby: true,
				Rating:        1,
			})
		} else {
			result = append(result, AirportResult{
				City:          city.Name,
				AirportNearby: false,
				Rating:        0,
			})
		}
	}

	content, err = json.MarshalIndent(result, "", " ")
	if err != nil {
		log.Panic(err.Error())
	}

	if err := os.WriteFile("result_airport.json", content, 0644); err != nil {
		log.Panic(err.Error())
	}
}

type ResultJSON struct {
	City          string  `json:"city"`
	Rating        float64 `json:"rating"`
	AirportNearby bool    `json:"airport_nearby"`
	BusStations   int     `json:"bus_stations"`
	RoadNearby    bool    `json:"road_nearby"`
}

type RoadResultJSON struct {
	City       string  `json:"city"`
	Rating     float64 `json:"rating"`
	RoadNearby bool    `json:"road_nearby"`
}

type AirportResultJSON struct {
	City          string  `json:"city"`
	Rating        float64 `json:"rating"`
	AirportNearby bool    `json:"airport_nearby"`
}

type BusResultJSON struct {
	City        string  `json:"city"`
	Rating      float64 `json:"rating"`
	BusStations int     `json:"bus_stations"`
}

func getResult() {
	content, err := os.ReadFile("./result_road.json")
	if err != nil {
		log.Panic("can not read file")
	}

	var r []RoadResultJSON
	if err := json.Unmarshal(content, &r); err != nil {
		log.Panic("can not Unmarshal")
	}

	content, err = os.ReadFile("./result_airport.json")
	if err != nil {
		log.Panic("can not read file")
	}

	var rr []AirportResultJSON
	if err := json.Unmarshal(content, &rr); err != nil {
		log.Panic("can not Unmarshal")
	}

	content, err = os.ReadFile("./result_bus.json")
	if err != nil {
		log.Panic("can not read file")
	}

	var rrr []BusResultJSON
	if err := json.Unmarshal(content, &rrr); err != nil {
		log.Panic("can not Unmarshal")
	}

	var res []ResultJSON

	for _, c := range r {
		for _, cc := range rr {
			if c.City == cc.City {
				for _, ccc := range rrr {
					if c.City == ccc.City {
						res = append(res, ResultJSON{
							City:          c.City,
							Rating:        math.Round((c.Rating * (cc.Rating + 1) * ccc.Rating) / 5),
							RoadNearby:    c.RoadNearby,
							AirportNearby: cc.AirportNearby,
							BusStations:   ccc.BusStations,
						})
						break
					}
				}

				break
			}
		}
	}

	content, err = json.MarshalIndent(res, "", " ")
	if err != nil {
		log.Panic(err.Error())
	}

	if err := os.WriteFile("result.json", content, 0644); err != nil {
		log.Panic(err.Error())
	}
}

func main() {
	// getRatingRoads()
	// getBuses()
	// getAirports()
	getResult()
}
